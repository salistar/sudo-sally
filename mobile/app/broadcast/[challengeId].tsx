/**
 * MOBILE NATIVE BROADCAST — /broadcast/<challengeId>
 *
 * Lets a phone broadcast a 1v1 match to YouTube with NO native media module and
 * NO screen-capture permission. Instead of capturing the (cluttered) phone
 * screen, an embedded WebView *recomposes* the two live boards onto a <canvas>
 * and encodes it (canvas.captureStream → MediaRecorder → WebM) straight to the
 * server relay (wss://…/api/youtube/ingest → ffmpeg → RTMP → YouTube). This is
 * the exact path already proven on web; the WebView is just a portable encoder.
 *
 * The RN side owns the data: it spectates the challenge over the socket and
 * forwards each frame into the WebView via injectJavaScript. The auth token is
 * injected the same way (never placed in a URL).
 *
 * On web there is nothing to embed — we send the user to /spectate, which has
 * the same canvas broadcaster inline.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { API_URL } from '../../utils/api';
import socketService from '../../utils/socket';

const IS_WEB = Platform.OS === 'web';
const RELAY_WSS = 'wss://api.sallysudo.com/api/youtube/ingest';

function parseBoard(s: any): number[] {
  if (!s) return new Array(81).fill(0);
  if (Array.isArray(s)) return s.flat().map((n: any) => parseInt(n, 10) || 0).slice(0, 81);
  if (typeof s === 'string') {
    const t = s.trim();
    if (t.startsWith('[')) { try { return (JSON.parse(t) as any[]).flat().map((n: any) => parseInt(n, 10) || 0).slice(0, 81); } catch {} }
    return t.split('').map((ch) => parseInt(ch, 10) || 0).slice(0, 81);
  }
  return new Array(81).fill(0);
}

// Self-contained encoder page: draws the composed match on a 1280×720 canvas and
// streams it to the relay. Exposes window.__start(token, cid) and window.__push(frame).
const ENCODER_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:#0a0a1a;overflow:hidden}#c{width:100%;height:auto;display:block}</style></head>
<body><canvas id="c" width="1280" height="720"></canvas><script>
var W=1280,H=720,canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
var F={lName:'Player 1',rName:'Player 2',lTime:0,rTime:0,lErr:0,rErr:0,lBoard:[],rBoard:[],givens:[],winnerName:null,live:true};
function post(o){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}
function fmt(s){s=s||0;return (''+Math.floor(s/60)).padStart(2,'0')+':'+(''+(s%60)).padStart(2,'0');}
function board(x,y,sz,b,g){var cell=sz/9;ctx.fillStyle='#0a0a1a';ctx.fillRect(x,y,sz,sz);
 for(var i=0;i<=9;i++){var M=i%3===0;ctx.strokeStyle=M?'#5a5a82':'#2a2a44';ctx.lineWidth=M?2.5:1;
  ctx.beginPath();ctx.moveTo(x+i*cell,y);ctx.lineTo(x+i*cell,y+sz);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x,y+i*cell);ctx.lineTo(x+sz,y+i*cell);ctx.stroke();}
 ctx.strokeStyle='#4a4a6a';ctx.lineWidth=3;ctx.strokeRect(x,y,sz,sz);
 ctx.textAlign='center';ctx.textBaseline='middle';
 for(var idx=0;idx<81;idx++){var v=(b&&b[idx])||0;if(!v)continue;var gv=((g&&g[idx])||0)>0,r=Math.floor(idx/9),c=idx%9;
  ctx.fillStyle=gv?'#fff':'#2dd4db';ctx.font=(gv?'800 ':'700 ')+Math.floor(cell*0.55)+'px Arial';
  ctx.fillText(''+v,x+c*cell+cell/2,y+r*cell+cell/2+1);}}
function frame(){var g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0a0a1a');g.addColorStop(.5,'#1a1a3a');g.addColorStop(1,'#0f0f2a');
 ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillStyle='#fff';ctx.font='900 38px Arial';ctx.fillText('\\u2694\\uFE0F  SallySudo 1v1',W/2,50);
 if(F.live&&!F.winnerName){ctx.fillStyle='#FF0000';ctx.beginPath();ctx.rect(W/2-60,78,120,30);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='800 16px Arial';ctx.fillText('\\u25CF LIVE',W/2+8,93);}
 var sz=440,gap=120,x0=(W-(sz*2+gap))/2,bY=200;
 var sides=[{x:x0,n:F.lName,t:F.lTime,e:F.lErr,b:F.lBoard,w:F.winnerName===F.lName},{x:x0+sz+gap,n:F.rName,t:F.rTime,e:F.rErr,b:F.rBoard,w:F.winnerName===F.rName}];
 for(var i=0;i<2;i++){var s=sides[i];ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='900 26px Arial';
  ctx.fillText((s.w?'\\uD83C\\uDFC6 ':'')+s.n,s.x+sz/2,bY-52);
  ctx.fillStyle='#fbbf24';ctx.font='700 20px Arial';ctx.fillText('\\u23F1\\uFE0F '+fmt(s.t)+'   \\u274C '+s.e,s.x+sz/2,bY-22);
  board(s.x,bY,sz,s.b,F.givens);}
 ctx.fillStyle='#ef4444';ctx.font='900 30px Arial';ctx.fillText('VS',W/2,bY+sz/2);
 if(F.winnerName){ctx.fillStyle='#fbbf24';ctx.font='900 30px Arial';ctx.fillText('\\uD83C\\uDFC6 '+F.winnerName+' wins!',W/2,bY+sz+40);}}
setInterval(frame,1000/15);frame();
window.__push=function(o){try{F=Object.assign(F,o);}catch(e){}};
var ws=null,mr=null,started=false;
window.__start=function(token,cid){
 if(started)return;started=true;post({type:'status',status:'connecting'});
 var stream=canvas.captureStream(15);
 try{var AC=window.AudioContext||window.webkitAudioContext;if(AC){var ac=new AC(),osc=ac.createOscillator(),gn=ac.createGain();gn.gain.value=0.0001;osc.connect(gn);var dst=ac.createMediaStreamDestination();gn.connect(dst);osc.start();dst.stream.getAudioTracks().forEach(function(t){stream.addTrack(t);});}}catch(e){}
 ws=new WebSocket('${RELAY_WSS}?token='+encodeURIComponent(token)+'&challengeId='+encodeURIComponent(cid)+'&privacy=unlisted');
 ws.binaryType='arraybuffer';
 ws.onmessage=function(ev){var m={};try{m=JSON.parse(ev.data);}catch(e){}
  if(m.type==='ready'){post({type:'status',status:'live',watchUrl:m.watchUrl,broadcastId:m.broadcastId});
   var cands=['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'];
   var mime='';for(var i=0;i<cands.length;i++){if(window.MediaRecorder&&MediaRecorder.isTypeSupported(cands[i])){mime=cands[i];break;}}
   mr=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:2500000}:undefined);
   mr.ondataavailable=function(e){if(e.data&&e.data.size&&ws.readyState===1){e.data.arrayBuffer().then(function(b){try{ws.send(b);}catch(_){}});}};
   mr.start(1000);
  } else if(m.type==='error'){post({type:'status',status:'error',error:m.error});}};
 ws.onclose=function(){post({type:'status',status:'closed'});};
 ws.onerror=function(){post({type:'status',status:'error',error:'socket error'});};
};
window.__stop=function(){try{mr&&mr.stop();}catch(e){}try{ws&&ws.send(JSON.stringify({type:'stop'}));}catch(e){}try{ws&&ws.close();}catch(e){}post({type:'status',status:'stopped'});};
post({type:'ready'});
</script></body></html>`;

export default function BroadcastPage() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const webRef = useRef<any>(null);
  const tokenRef = useRef<string>('');
  const idsRef = useRef<{ challengerId: string; challengedId: string }>({ challengerId: '', challengedId: '' });
  const givensRef = useRef<number[]>([]);
  const playing = useRef(true);
  const namesRef = useRef<{ l: string; r: string }>({ l: 'Player 1', r: 'Player 2' });
  const fr = useRef<any>({ lTime: 0, rTime: 0, lErr: 0, rErr: 0, lBoard: [], rBoard: [], winnerName: null });

  const [status, setStatus] = useState<'loading' | 'connecting' | 'live' | 'error' | 'closed'>('loading');
  const [watchUrl, setWatchUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // On web there's no WebView to embed — the /spectate page has the same canvas
  // broadcaster, so just go there with auto-broadcast on.
  useEffect(() => {
    if (IS_WEB && challengeId) router.replace(`/spectate/${challengeId}?autobroadcast=1`);
  }, [challengeId]);

  const push = (partial: any) => {
    try { webRef.current?.injectJavaScript(`window.__push && window.__push(${JSON.stringify(partial)}); true;`); } catch {}
  };

  useEffect(() => {
    if (IS_WEB || !challengeId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = (await AsyncStorage.getItem('sudoku_token')) || '';
        tokenRef.current = token;
        const r = await fetch(`${API_URL}/challenges/${challengeId}/spectate`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const j = await r.json();
        if (cancelled) return;
        if (!j?.spectate) { setErr(j?.error || 'Match not found'); setStatus('error'); return; }
        const s = j.spectate;
        idsRef.current = { challengerId: s.challengerId, challengedId: s.challengedId };
        givensRef.current = parseBoard(s.puzzle);
        namesRef.current = { l: s.challenger?.username || 'Player 1', r: s.challenged?.username || 'Player 2' };
        fr.current = {
          lTime: s.challengerTime || 0, rTime: s.challengedTime || 0, lErr: s.challengerErrors || 0, rErr: s.challengedErrors || 0,
          lBoard: parseBoard(s.challengerBoard), rBoard: parseBoard(s.challengedBoard), winnerName: s.winner?.username || null,
        };
        if (s.winner?.username || s.status !== 'playing') playing.current = false;
        push({ lName: namesRef.current.l, rName: namesRef.current.r, givens: givensRef.current, ...fr.current, live: playing.current });

        await socketService.connect();
        socketService.spectateChallenge(challengeId);
        socketService.on('opponent:progress', (d: any) => {
          const board = parseBoard(d?.board);
          if (d?.odcUserId === idsRef.current.challengerId) { fr.current.lBoard = board; if (d.timeSpent != null) fr.current.lTime = d.timeSpent; if (d.errors != null) fr.current.lErr = d.errors; }
          else if (d?.odcUserId === idsRef.current.challengedId) { fr.current.rBoard = board; if (d.timeSpent != null) fr.current.rTime = d.timeSpent; if (d.errors != null) fr.current.rErr = d.errors; }
          push({ lBoard: fr.current.lBoard, rBoard: fr.current.rBoard, lTime: fr.current.lTime, rTime: fr.current.rTime, lErr: fr.current.lErr, rErr: fr.current.rErr });
        });
        const onEnd = (d: any) => { playing.current = false; const wn = d?.username || d?.winner?.username || d?.winnerName; if (wn) { fr.current.winnerName = wn; push({ winnerName: wn, live: false }); } };
        socketService.on('player:completed', onEnd);
        socketService.on('challenge:result', onEnd);
      } catch (e: any) { if (!cancelled) { setErr(String(e?.message || e)); setStatus('error'); } }
    })();
    return () => {
      cancelled = true;
      try { webRef.current?.injectJavaScript('window.__stop && window.__stop(); true;'); } catch {}
      socketService.removeAllListeners('opponent:progress');
      socketService.removeAllListeners('player:completed');
      socketService.removeAllListeners('challenge:result');
    };
  }, [challengeId]);

  // local 1s tick so clocks advance between socket events
  useEffect(() => {
    if (IS_WEB) return;
    const iv = setInterval(() => {
      if (!playing.current) return;
      fr.current.lTime += 1; fr.current.rTime += 1;
      push({ lTime: fr.current.lTime, rTime: fr.current.rTime });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const onWebMessage = (e: any) => {
    let m: any = {}; try { m = JSON.parse(e?.nativeEvent?.data || '{}'); } catch {}
    if (m.type === 'ready') {
      // encoder page loaded → push initial frame + start the broadcast
      push({ lName: namesRef.current.l, rName: namesRef.current.r, givens: givensRef.current, ...fr.current, live: playing.current });
      try { webRef.current?.injectJavaScript(`window.__start && window.__start(${JSON.stringify(tokenRef.current)}, ${JSON.stringify(challengeId)}); true;`); } catch {}
    } else if (m.type === 'status') {
      if (m.status === 'live') { setStatus('live'); if (m.watchUrl) setWatchUrl(m.watchUrl); }
      else if (m.status === 'connecting') setStatus('connecting');
      else if (m.status === 'error') { setStatus('error'); setErr(m.error || 'broadcast error'); }
      else if (m.status === 'closed' || m.status === 'stopped') setStatus('closed');
    }
  };

  if (IS_WEB) {
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#2dd4db" />
        <Text style={{ color: '#94a3b8', marginTop: 10 }}>Redirection vers le studio de diffusion…</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={{ flex: 1 }}>
      <View style={{ paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>🔴 Diffusion en direct</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: status === 'live' ? '#22c55e' : status === 'error' ? '#ef4444' : '#fbbf24' }} />
          <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '700' }}>
            {status === 'loading' ? 'Chargement du match…' : status === 'connecting' ? 'Connexion à YouTube…' : status === 'live' ? 'EN DIRECT sur YouTube' : status === 'error' ? `Erreur : ${err || ''}` : 'Diffusion terminée'}
          </Text>
        </View>
        {!!watchUrl && <Text style={{ color: '#2dd4db', fontSize: 12, marginTop: 6 }}>🔗 {watchUrl}</Text>}
      </View>

      {/* the encoder canvas (also the live preview) */}
      <View style={{ marginHorizontal: 12, borderRadius: 10, overflow: 'hidden', aspectRatio: 16 / 9, backgroundColor: '#0a0a1a' }}>
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: ENCODER_HTML, baseUrl: 'https://app.sallysudo.com' }}
          onMessage={onWebMessage}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          mixedContentMode="always"
          style={{ flex: 1, backgroundColor: '#0a0a1a' }}
        />
      </View>

      <View style={{ padding: 16, gap: 10 }}>
        <TouchableOpacity
          onPress={() => { try { webRef.current?.injectJavaScript('window.__stop && window.__stop(); true;'); } catch {}; router.back(); }}
          style={{ backgroundColor: '#ef4444', paddingVertical: 13, borderRadius: 12, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>⏹️ Arrêter et revenir</Text>
        </TouchableOpacity>
        <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center' }}>
          La diffusion recompose les 2 plateaux en direct et les envoie sur ta chaîne YouTube via le relais — aucune capture d'écran requise.
        </Text>
      </View>
    </LinearGradient>
  );
}
