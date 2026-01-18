import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, TextInput, Button, Alert, Dimensions, Image, ActivityIndicator, FlatList, ScrollView, Linking } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabaseConfig'; 
import * as Device from 'expo-device'; 
import * as ImagePicker from 'expo-image-picker';

// Importamos las funciones necesarias de tu biblioteca
import { cargarMapa, abrirGestionMascotas, ejecutarEliminacion, seleccionarImagenDeGaleria, registrarMascota } from './backend';

// 1. Configuración de Notificaciones (Actualizada para evitar warnings)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, 
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [appReady, setAppReady] = useState(false); 
  const [location, setLocation] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [lostPets, setLostPets] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [userPets, setUserPets] = useState([]);
  
  // --- ESTADOS PARA DETALLES ---
  const [selectedPet, setSelectedPet] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  
  // --- ESTADOS DEL FORMULARIO ---
  const [petName, setPetName] = useState('');
  const [petContact, setPetContact] = useState('');
  const [petDescription, setPetDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  const notifiedPets = useRef(new Set());

  // 1. CARGA INICIAL Y GPS (Solo corre una vez [])
  useEffect(() => {
    async function prepare() {
      try {
        await cargarMapa(setLostPets);

        const id = Device.osBuildId || Device.modelName || 'anonymous';
        setDeviceId(id);

        let { status: gpsStatus } = await Location.requestForegroundPermissionsAsync();
        let { status: notifStatus } = await Notifications.requestPermissionsAsync();
        let { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (gpsStatus !== 'granted') {
          Alert.alert("Permiso denegado", "Se necesita GPS para el mapa.");
        }
        
        if (galleryStatus !== 'granted') {
          Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos para poder reportar.");
        }

        if (gpsStatus === 'granted') {
          let loc = await Location.getCurrentPositionAsync({});
          setLocation(loc);

          await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, distanceInterval: 10 },
            (newLocation) => {
              setLocation(newLocation);
              verificarProximidad(newLocation, lostPets);
            }
          );
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000)); 
      } catch (e) {
        console.warn("Error en prepare:", e);
        setAppReady(true);
      }
    }
    prepare();

    const subscription = supabase
      .channel('public:mascotas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mascotas' }, payload => {
        const newPet = payload.new;
        setLostPets(current => {
          const updatedList = [payload.new, ...current];
          if (location) verificarProximidad(location, [payload.new]);
          return updatedList;
        });
        
        // Notificación inmediata si la nueva mascota está cerca
        if (location) verificarProximidad(location, [newPet]);
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  // --- FUNCIONES DE LA BIBLIOTECA ---
  const toggleMisReportes = () => abrirGestionMascotas(deviceId, setUserPets, setDrawerVisible);
  const handleBorrar = (id) => ejecutarEliminacion(id, userPets, setUserPets, () => cargarMapa(setLostPets));

  const handleSeleccionarImagen = async () => {
    const imagen = await seleccionarImagenDeGaleria();
    if (imagen) setSelectedImage(imagen);
  };

  // Función para abrir la ficha de detalle
  const verDetalle = (pet) => {
    setSelectedPet(pet);
    setDetailVisible(true);
  };

  // Función para llamar al dueño
  const llamarDuenio = (numero) => {
    if (!numero) return Alert.alert("Error", "No hay número de contacto.");
    Linking.openURL(`tel:${numero}`);
  };

  const handleReportar = async () => {
    if (!petName || !petContact || !location) {
      return Alert.alert("Faltan datos", "Por favor ingresa nombre y número de contacto.");
    }

    try {
      setAppReady(false);
      await registrarMascota({
        nombre: petName,
        contacto: petContact,
        descripcion: petDescription,
        imagenData: selectedImage,
        latitud: location.coords.latitude,
        longitud: location.coords.longitude,
        deviceId: deviceId
      });

      setModalVisible(false);
      resetForm();
      Alert.alert("¡Éxito!", "Mascota reportada correctamente.");
    } catch (err) {
      Alert.alert("Error", err.message === "DUPLICADO" ? "Ya reportaste a esta mascota." : "No se pudo enviar.");
    } finally {
      setAppReady(true);
    }
  };

  const resetForm = () => {
    setPetName('');
    setPetContact('');
    setPetDescription('');
    setSelectedImage(null);
  };

  // --- LÓGICA DE GEOCERCAS ---
  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const verificarProximidad = (userLoc, petsArray) => {
    const RADIUS = 200; 
    petsArray.forEach(pet => {
      const dist = calcularDistancia(userLoc.coords.latitude, userLoc.coords.longitude, pet.latitud, pet.longitud);
      if (dist <= RADIUS && !notifiedPets.current.has(pet.id)) {
        Notifications.scheduleNotificationAsync({
          content: { title: "🐾 ¡Mascota Cerca!", body: `Entraste al perímetro de ${pet.nombre}. ¡Mantente alerta!` },
          trigger: null,
        });
        notifiedPets.current.add(pet.id);
      }
    });
  };

  if (!appReady) {
    return (
      <View style={styles.splashContainer}>
        <Image source={require('./assets/icono.png')} style={styles.splashLogo} resizeMode="contain" />
        <ActivityIndicator size="large" color="#a5cc5d" style={{ marginTop: 20 }} />
        <Text style={styles.splashText}>Procesando...</Text>
      </View>
    );
  }
return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.menuButton} onPress={toggleMisReportes}>
        <Text style={styles.menuIconText}>☰</Text>
      </TouchableOpacity>

      {location && (
        <MapView 
          style={styles.map} 
          mapType="satellite" 
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
        >
          {lostPets.map(pet => (
            pet.latitud && pet.longitud && (
              <React.Fragment key={pet.id}>
                <Marker 
                  coordinate={{ latitude: pet.latitud, longitude: pet.longitud }} 
                  pinColor="red"
                  onPress={() => verDetalle(pet)} // Al tocar el pin, abre la ficha
                />
                <Circle 
                  center={{ latitude: pet.latitud, longitude: pet.longitud }} 
                  radius={200} 
                  fillColor="rgba(255, 0, 0, 0.1)" 
                  strokeColor="rgba(255, 0, 0, 0.3)" 
                />
              </React.Fragment>
            )
          ))}
        </MapView>
      )}

      {/* 2. BOTÓN FLOTANTE "+" (Único punto de acción) */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* MODAL DE DETALLE DE MASCOTA (FICHA) */}
      <Modal visible={detailVisible} animationType="slide" transparent={true}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailContainer}>
            {selectedPet && (
              <>
                <Text style={styles.detailTitle}>🚨 ¡Mascota Localizada!</Text>
                
                {selectedPet.imagen_url ? (
                  <Image source={{ uri: selectedPet.imagen_url }} style={styles.detailImage} />
                ) : (
                  <View style={[styles.detailImage, {backgroundColor: '#f1f2f6', justifyContent: 'center', alignItems: 'center'}]}>
                    <Text>Sin foto disponible</Text>
                  </View>
                )}

                <Text style={styles.petNameText}>{selectedPet.nombre}</Text>
                <Text style={styles.petDescText}>{selectedPet.descripcion || "Sin descripción adicional."}</Text>
                
                <TouchableOpacity 
                  style={styles.callButton} 
                  onPress={() => llamarDuenio(selectedPet.contacto)}
                >
                  <Text style={styles.callButtonText}>📞 Llamar al dueño</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailVisible(false)}>
                  <Text style={styles.closeBtnText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL DE REPORTE */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>🐾 Reportar Mascota</Text>
            
            <TextInput style={styles.input} placeholder="Nombre de la mascota" value={petName} onChangeText={setPetName} />
            <TextInput style={styles.input} placeholder="Teléfono de contacto" keyboardType="phone-pad" value={petContact} onChangeText={setPetContact} />
            <TextInput style={[styles.input, {height: 80}]} placeholder="Descripción (color, collar, etc.)" multiline value={petDescription} onChangeText={setPetDescription} />
            
            <TouchableOpacity style={styles.imageButton} onPress={handleSeleccionarImagen}>
              <Text style={styles.imageButtonText}>{selectedImage ? "✅ Foto seleccionada" : "📸 Elegir de Galería"}</Text>
            </TouchableOpacity>

            <View style={{ gap: 10, marginTop: 10 }}>
              <Button title="Lanzar Alerta" onPress={handleReportar} color="#ff4757" />
              <Button title="Cancelar" onPress={() => { setModalVisible(false); resetForm(); }} color="#2f3542" />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL SLIDE LATERAL */}
      <Modal visible={drawerVisible} animationType="slide" transparent={true}>
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerContainer}>
            <Text style={styles.drawerTitle}>Mis Reportes</Text>
            <FlatList
              data={userPets}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.petItem}>
                  <Text style={styles.petItemName}>{item.nombre}</Text>
                  <TouchableOpacity onPress={() => handleBorrar(item.id)}>
                    <Text style={{fontSize: 24}}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            <Button title="Cerrar" onPress={() => setDrawerVisible(false)} color="#3d3430" />
          </View>
          <TouchableOpacity style={{flex: 1}} onPress={() => setDrawerVisible(false)} />
        </View>
      </Modal>
    </View>
  );
}

// ESTILOS LIMPIOS
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { width: '100%', height: '100%' },
  splashContainer: { flex: 1, backgroundColor: '#3d3430', justifyContent: 'center', alignItems: 'center' },
  splashLogo: { width: 200, height: 200 },
  splashText: { color: '#fff', marginTop: 10, fontSize: 16, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#ff4757', width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  fabText: { color: 'white', fontSize: 35, fontWeight: 'bold' },
  menuButton: { position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: '#fff', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  menuIconText: { fontSize: 24, color: '#3d3430' },
  
  // ESTILOS DE LA FICHA DE DETALLES
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailContainer: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, alignItems: 'center', elevation: 20 },
  detailTitle: { fontSize: 18, fontWeight: 'bold', color: '#ff4757', marginBottom: 15 },
  detailImage: { width: '100%', height: 200, borderRadius: 20, marginBottom: 15 },
  petNameText: { fontSize: 24, fontWeight: 'bold', color: '#2f3542' },
  petDescText: { fontSize: 16, color: '#57606f', textAlign: 'center', marginVertical: 10 },
  callButton: { backgroundColor: '#2ed573', padding: 15, borderRadius: 15, width: '100%', alignItems: 'center', marginTop: 10 },
  callButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  closeBtn: { marginTop: 15, padding: 10 },
  closeBtnText: { color: '#a4b0be', fontWeight: 'bold' },

  // OTROS ESTILOS
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalContent: { marginHorizontal: 20, backgroundColor: 'white', padding: 25, borderRadius: 25, elevation: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderBottomWidth: 1, borderColor: '#ddd', marginBottom: 15, padding: 10, fontSize: 16 },
  imageButton: { backgroundColor: '#f1f2f6', padding: 15, borderRadius: 10, marginBottom: 20, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#a4b0be' },
  imageButtonText: { color: '#2f3542', fontWeight: 'bold' },
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  drawerContainer: { width: '80%', backgroundColor: '#fff', height: '100%', padding: 25, paddingTop: 60 },
  drawerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#3d3430' },
  petItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  petItemName: { fontSize: 16, color: '#333' }
});