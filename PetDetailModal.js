import React from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { COLORS, THEME } from './Theme';

export default function PetDetailModal({ visible, pet, onClose }) {
  if (!pet) return null; // Si no hay mascota seleccionada, no renderiza nada

  const handleEncontrado = () => {
    // Lógica para contactar al dueño vía WhatsApp o Llamada
    const url = `tel:${pet.contacto}`;
    Linking.openURL(url).catch(() => 
      alert("No se pudo abrir la aplicación de llamadas.")
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        <View style={[THEME.infoCard, styles.cardSize]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            
            <Text style={styles.headerText}>Información de la Mascota</Text>

            {/* FOTO DE LA MASCOTA CON BORDE PIXEL */}
            <View style={styles.imageFrame}>
              {pet.imagen_url ? (
                <Image source={{ uri: pet.imagen_url }} style={styles.petImage} />
              ) : (
                <View style={styles.noImage}>
                   <Text style={THEME.label}>Sin Foto</Text>
                </View>
              )}
            </View>

            {/* CAMPOS DE INFORMACIÓN */}
            <View style={styles.infoSection}>
              <Text style={THEME.label}>Nombre:</Text>
              <View style={styles.dataBox}><Text style={styles.dataText}>{pet.nombre}</Text></View>

              <Text style={THEME.label}>Descripción:</Text>
              <View style={styles.dataBox}>
                <Text style={styles.dataText}>{pet.descripcion || "Sin descripción adicional."}</Text>
              </View>

              <Text style={THEME.label}>Contacto del Dueño:</Text>
              <View style={styles.dataBox}><Text style={styles.dataText}>{pet.contacto}</Text></View>
            </View>

            {/* BOTÓN RPG "LO ENCONTRÉ" */}
            <TouchableOpacity style={THEME.rpgButton} onPress={handleEncontrado}>
              <Text style={styles.buttonText}>¡LO ENCONTRÉ!</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>CERRAR</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  cardSize: { width: '90%', maxHeight: '85%' },
  headerText: { ...THEME.headerTitle, marginBottom: 20, fontSize: 18 },
  imageFrame: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    borderWidth: 4,
    borderColor: COLORS.borderDark,
    backgroundColor: '#FFF',
    marginBottom: 20,
    padding: 5
  },
  petImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  noImage: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#DDD' },
  infoSection: { marginBottom: 10 },
  dataBox: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.buttonBrown
  },
  dataText: { fontFamily: 'monospace', fontSize: 16, color: COLORS.textDark },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 20, fontFamily: 'monospace' },
  closeBtn: { marginTop: 15, alignSelf: 'center' },
  closeBtnText: { color: COLORS.buttonBrown, fontFamily: 'monospace', fontWeight: 'bold', textDecorationLine: 'underline' }
});