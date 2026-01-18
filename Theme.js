import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

// 1. PALETA DE COLORES (Extraída de tus imágenes)
export const COLORS = {
  bgDark: '#3D352D',        // Fondo café oscuro (Logo y Splash)
  accentGreen: '#A4C639',   // Verde neón (Brillo del logo)
  parchmentLight: '#F1E4C0', // Fondo de la tarjeta de mascota (Claro)
  parchmentDark: '#C8AD7F',  // Fondo de la barra inferior (Pergamino)
  buttonBrown: '#6B4423',    // Color del botón "¡LO ENCONTRÉ!"
  textDark: '#1A1A1A',       // Texto para pergamino
  textLight: '#FFFFFF',      // Texto para fondos oscuros
  borderDark: '#2D1B0C',     // Bordes gruesos de botones y tarjetas
};

// 2. TEXTURA PARA EL MAPA (Estilo Retro)
export const MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#ebe3cd" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#523735" }] },
  { "featureType": "landscape.natural", "stylers": [{ "color": "#dfd2ae" }] },
  { "featureType": "water", "stylers": [{ "color": "#b9d3c2" }] }
];

// 3. ESTILOS DE INTERFAZ (UI)
export const THEME = StyleSheet.create({
  // Tarjeta tipo Pergamino (Como la de Max)
  infoCard: {
    backgroundColor: COLORS.parchmentLight,
    borderWidth: 4,
    borderColor: COLORS.borderDark,
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 0, // Sombras sin difuminado para look pixel
  },

  // Botón Estilo RPG con profundidad
  rpgButton: {
    backgroundColor: COLORS.buttonBrown,
    borderWidth: 3,
    borderBottomWidth: 7, // Efecto de botón presionado
    borderColor: COLORS.borderDark,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Entradas de texto (Inputs)
  pixelInput: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderWidth: 2,
    borderColor: COLORS.borderDark,
    borderRadius: 5,
    padding: 10,
    color: COLORS.textDark,
    fontFamily: 'monospace',
    marginBottom: 15,
  },

  // Textos y Títulos
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textDark,
    textAlign: 'center',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },

  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textDark,
    fontFamily: 'monospace',
    marginBottom: 5,
  }
});