import { supabase } from './supabaseConfig';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Alert } from 'react-native';

/**
 * 1. CARGAR MAPA: Obtiene todas las mascotas para los pins
 */
export const cargarMapa = async (setLostPets) => {
    try {
        const { data, error } = await supabase.from('mascotas').select('*');
        if (error) throw error;
        // Solo guardamos mascotas que tengan coordenadas para evitar que el mapa explote
        const filtrados = data.filter(p => p.latitud && p.longitud);
        setLostPets(filtrados);
    } catch (e) {
        console.error("Error al cargar mapa:", e.message);
    }
};

/**
 * 2. GESTIÓN LATERAL: Obtiene las mascotas del usuario actual
 */
export const abrirGestionMascotas = async (deviceId, setUserPets, setDrawerVisible) => {
    try {
        const { data, error } = await supabase
            .from('mascotas')
            .select('*')
            .eq('user_id', deviceId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        setUserPets(data);
        setDrawerVisible(true);
    } catch (e) {
        Alert.alert("Error", "No pudimos cargar tus reportes.");
    }
};

/**
 * 3. ELIMINACIÓN: Borra un reporte con confirmación visual
 */
export const ejecutarEliminacion = async (petId, userPets, setUserPets, alTerminar) => {
    Alert.alert(
        "Eliminar Alerta",
        "¿Estás seguro? Se borrará permanentemente.",
        [
            { text: "Cancelar", style: "cancel" },
            { 
                text: "Eliminar", 
                style: "destructive", 
                onPress: async () => {
                    const { error } = await supabase.from('mascotas').delete().eq('id', petId);
                    if (!error) {
                        setUserPets(userPets.filter(p => p.id !== petId));
                        alTerminar(); // Llama a cargarMapa para limpiar el pin del mapa
                        Alert.alert("Éxito", "Reporte eliminado.");
                    }
                }
            }
        ]
    );
};

/**
 * 4. GALERÍA: Abre la galería y devuelve la imagen
 */
export const seleccionarImagenDeGaleria = async () => {
    try {
        // Forzamos la petición de permiso justo antes de abrir
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (status !== 'granted') {
            Alert.alert("Permiso denegado", "No podemos abrir la galería sin tu permiso.");
            return null;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            // Usamos la configuración más compatible
            mediaTypes: ImagePicker.MediaTypeOptions.Images, 
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            return result.assets[0];
        }
        return null;
    } catch (error) {
        console.error("Error al abrir la galería:", error);
        Alert.alert("Error", "No se pudo abrir la galería del dispositivo.");
        return null;
    }
};

/**
 * 5. STORAGE: Sube la foto (Función interna)
 */
const subirFoto = async (imagen) => {
    const nombreArchivo = `pet_${Date.now()}.jpg`;
    const { error } = await supabase.storage
        .from('mascotas_fotos')
        .upload(nombreArchivo, decode(imagen.base64), { contentType: 'image/jpeg' });

    if (error) throw error;

    const { data: urlData } = supabase.storage
        .from('mascotas_fotos')
        .getPublicUrl(nombreArchivo);

    return urlData.publicUrl;
};

/**
 * 6. REGISTRO: Proceso completo de guardado
 */
export const registrarMascota = async (datos) => {
    try {
        console.log("--- INICIANDO REGISTRO ---");
        
        let urlImagen = null;
        if (datos.imagenData) {
            console.log("📸 Intentando subir foto a Storage...");
            urlImagen = await subirFoto(datos.imagenData);
            console.log("🔗 URL obtenida:", urlImagen);
        }

        console.log("📝 Insertando en base de datos...");
        const { error } = await supabase.from('mascotas').insert([
            {
                nombre: datos.nombre,
                contacto: datos.contacto,
                descripcion: datos.descripcion,
                imagen_url: urlImagen,
                latitud: datos.latitud,
                longitud: datos.longitud,
                user_id: datos.deviceId
            }
        ]);

        if (error) {
            // ESTO ES LO QUE NECESITO QUE ME DIGAS:
            console.log("❌ ERROR DE SUPABASE DB:", error.message);
            console.log("Detalles:", error.details);
            throw error;
        }

        return true;
    } catch (e) {
        console.log("🔥 ERROR TOTAL EN EL PROCESO:", e.message);
        throw e;
    }
};