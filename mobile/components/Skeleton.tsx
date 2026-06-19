import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, ViewStyle } from 'react-native';

export default function Skeleton({ width = '100%', height = 16, radius = 8, style }:
  { width?: number | string; height?: number; radius?: number; style?: ViewStyle }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.7, 0.35] });
  return (
    <Animated.View style={[{ width: width as any, height, borderRadius: radius, backgroundColor: 'rgba(255,255,255,0.08)', opacity }, style]} />
  );
}

// Convenience: a vertical list of row skeletons.
export function SkeletonList({ rows = 6, rowHeight = 56, gap = 10 }: { rows?: number; rowHeight?: number; gap?: number }) {
  return (
    <View style={{ gap, width: '100%' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)' }}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width={'60%'} height={12} />
            <Skeleton width={'35%'} height={10} />
          </View>
          <Skeleton width={48} height={20} radius={8} />
        </View>
      ))}
    </View>
  );
}
