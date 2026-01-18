import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, THEME } from './Theme';
import { registrarMascota, seleccionarImagenDeGaleria, cargarMapa } from './backend';

export default function ReportModal({ visible, onClose, userLocation, deviceId, onRefresh }) {
  const [form, setForm] = useState({ nombre: '', telefono: '', descripcion: '' });
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handlePickImage = async () => {
    const img = await seleccionarImagenDeGaleria();
    if (img) setSelectedImage(img);
  };

  const handleReport = async () => {
    if (!form.nombre || !form.telefono || !userLocation) {
      return Alert.alert("Misión Incompleta", "Nombre, teléfono y ubicación son obligatorios.");
    }

    setUploading(true);
    try {
      await registrarMascota({
        nombre: form.nombre,
        contacto: form.telefono,
        descripcion: form.descripcion,
        imagenData: selectedImage, // Se procesa en backend.js
        latitud: userLocation.coords.latitude,
        longitud: userLocation.coords.longitude,
        deviceId: deviceId
      });

      Alert.alert("¡Alerta Lanzada!", "La comunidad ha sido notificada.");
      setForm({ nombre: '', telefono: '', descripcion: '' });
      setSelectedImage(null);
      onRefresh(); // Recarga el mapa
      onClose();
    } catch (error) {
      Alert.alert("Error de Conexión", error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={[THEME.infoCard, { maxHeight: '85%' }]}> 
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={THEME.headerTitle}>🐾 REPORTE DE MASCOTA</Text>
            
            <TouchableOpacity style={styles.imagePlaceholder} onPress={handlePickImage}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
              ) : (
                <View style={styles.emptyImageIcon}><Text style={styles.imageText}>[ AÑADIR FOTO ]</Text></View>
              )}
            </TouchableOpacity>

            <Text style={THEME.label}>Nombre:</Text>
            <TextInput style={THEME.pixelInput} placeholder="¿Cómo se llama?" value={form.nombre} onChangeText={(t) => setForm({...form, nombre: t})} />

            <Text style={THEME.label}>Contacto del dueño:</Text>
            <TextInput style={THEME.pixelInput} placeholder="Teléfono" keyboardType="phone-pad" value={form.telefono} onChangeText={(t) => setForm({...form, telefono: t})} />

            <Text style={THEME.label}>Descripción / Señas:</Text>
            <TextInput style={[THEME.pixelInput, { height: 70 }]} multiline value={form.descripcion} onChangeText={(t) => setForm({...form, descripcion: t})} />

            <TouchableOpacity style={THEME.rpgButton} onPress={handleReport} disabled={uploading}>
              {uploading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>¡LANZAR ALERTA!</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={{ marginTop: 15 }}>
              <Text style={styles.cancelText}>VOLVER AL MAPA</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 15 },
  imagePlaceholder: { width: '100%', height: 160, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.buttonBrown },
  previewImage: { width: '100%', height: '100%', borderRadius: 8 },
  imageText: { fontWeight: 'bold', color: COLORS.buttonBrown, fontFamily: 'monospace' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 18, fontFamily: 'monospace' },
  cancelText: { textAlign: 'center', color: '#888', fontFamily: 'monospace', textDecorationLine: 'underline' }
});