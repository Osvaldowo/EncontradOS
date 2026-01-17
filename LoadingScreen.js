import React from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';

export default function LoadingScreen() {
    return (
    <View style={styles.container}>
        <Image 
        source={require('./assets/splash-encontrados.png')} 
        style={styles.logo}
        resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#78e08f" style={{ marginTop: 20 }} />
        <Text style={styles.text}>Buscando huellas...</Text>
    </View>
    );
}

const styles = StyleSheet.create({
    container: {
    flex: 1,
    backgroundColor: '#3d352d', // El mismo color del logo
    justifyContent: 'center',
    alignItems: 'center',
    },
    logo: {
    width: 250,
    height: 250,
    },
    text: {
    color: '#78e08f',
    marginTop: 10,
    fontSize: 18,
    fontFamily: 'monospace', // Estilo pixel/retro
    }
});