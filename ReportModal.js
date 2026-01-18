import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabaseConfig';
import { COLORS, THEME } from './Th eme';

export default function ReportModal({ visible, onClose, userLocation }) {
  const [form, setForm] = useState({ nombre: '', telefono: '', descripcion: '' });
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Cuadrado como en tu imagen de referencia
      quality: 0.5,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleReport = async () => {
    if (!form.nombre || !form.telefono || !userLocation) {
      return Alert.alert("Misión Incompleta", "El nombre, teléfono y ubicación son obligatorios.");
    }

    setUploading(true);
    try {
      // Inserción en la base de datos
      const { error } = await supabase.from('mascotas').insert([
        { 
          nombre: form.nombre, 
          contacto: form.telefono, 
          descripcion: form.descripcion,
          latitud: userLocation.coords.latitude,
          longitud: userLocation.coords.longitude,
          imagen_url: image // URI Local por ahora
        }
      ]);

      if (error) throw error;

      Alert.alert("¡Alerta Lanzada!", "La comunidad ha sido notificada.");
      
      // Limpiar formulario al cerrar
      setForm({ nombre: '', telefono: '', descripcion: '' });
      setImage(null);
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
        {/* Usamos el infoCard del Theme para mantener la estética pergamino */}
        <View style={[THEME.infoCard, { maxHeight: '80%' }]}> 
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[THEME.headerTitle, { color: COLORS.borderDark, marginBottom: 20 }]}>
              🐾 REPORTE DE MASCOTA
            </Text>
            
            <TouchableOpacity style={styles.imagePlaceholder} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.previewImage} />
              ) : (
                <View style={styles.emptyImageIcon}>
                   <Text style={styles.imageText}>[ AÑADIR FOTO ]</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={THEME.label}>Nombre:</Text>
            <TextInput 
              style={THEME.pixelInput} 
              placeholder="¿Cómo se llama?" 
              placeholderTextColor="#888"
              value={form.nombre}
              onChangeText={(t) => setForm({...form, nombre: t})}
            />

            <Text style={THEME.label}>Contacto del dueño:</Text>
            <TextInput 
              style={THEME.pixelInput} 
              placeholder="Teléfono de emergencia" 
              placeholderTextColor="#888"
              keyboardType="phone-pad"
              value={form.telefono}
              onChangeText={(t) => setForm({...form, telefono: t})}
            />

            <Text style={THEME.label}>Descripción / Señas:</Text>
            <TextInput 
              style={[THEME.pixelInput, { height: 80, textAlignVertical: 'top' }]} 
              placeholder="Ej: Collar rojo, mancha en la oreja..." 
              placeholderTextColor="#888"
              multiline
              value={form.descripcion}
              onChangeText={(t) => setForm({...form, descripcion: t})}
            />

            <TouchableOpacity 
              style={[THEME.rpgButton, { opacity: uploading ? 0.6 : 1 }]} 
              onPress={handleReport}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>¡LANZAR ALERTA!</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
              <Text style={styles.cancelText}>VOLVER AL MAPA</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center',
    padding: 10 
  },
  imagePlaceholder: { 
    width: '100%', 
    height: 180, 
    backgroundColor: 'rgba(0,0,0,0.1)', 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 20, 
    borderStyle: 'dashed', 
    borderWidth: 2, 
    borderColor: '#6B4423' 
  },
  previewImage: { width: '100%', height: '100%', borderRadius: 8 },
  emptyImageIcon: { alignItems: 'center' },
  imageText: { fontWeight: 'bold', color: '#6B4423', fontFamily: 'monospace' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 18, fontFamily: 'monospace' },
  cancelText: { 
    textAlign: 'center', 
    color: '#888', 
    fontWeight: 'bold', 
    fontFamily: 'monospace',
    textDecorationLine: 'underline' 
  }
});