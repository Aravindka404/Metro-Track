import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StationProvider } from './src/context/StationContext';
import { MetroMap } from './src/components/MetroMap';
import { HeaderBar } from './src/components/HeaderBar';
import { BottomSheet } from './src/components/BottomSheet';

export default function App() {
  return (
    <SafeAreaProvider>
      <StationProvider>
        <View style={styles.rootContainer}>
          <StatusBar style="light" translucent backgroundColor="transparent" />
          {/* Edge-to-Edge Native Map Canvas */}
          <MetroMap />

          {/* Floating Frosted Header Bar */}
          <HeaderBar />

          {/* Interactive Native Bottom Sheet */}
          <BottomSheet />
        </View>
      </StationProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
});
