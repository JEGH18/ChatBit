// Catálogos usados por el formulario de registro "persona natural" de Neocrédito.
// Ajusta estas listas si las opciones del formulario real cambian.

export const TIPOS_DOCUMENTO = [
  { value: 'CÉDULA DE CIUDADANÍA', aliases: ['cc', 'cedula', 'cedula de ciudadania', 'ciudadania'] },
  { value: 'CÉDULA DE EXTRANJERÍA', aliases: ['ce', 'cedula de extranjeria', 'extranjeria'] },
  { value: 'PASAPORTE', aliases: ['pasaporte', 'pa', 'passport'] },
  { value: 'PERMISO POR PROTECCIÓN TEMPORAL', aliases: ['ppt', 'permiso por proteccion temporal', 'permiso de proteccion temporal'] },
];

export const GENEROS = [
  { value: 'MASCULINO', aliases: ['m', 'hombre', 'masculino', 'varon'] },
  { value: 'FEMENINO', aliases: ['f', 'mujer', 'femenino'] },
  { value: 'OTRO', aliases: ['otro', 'no binario', 'otra'] },
];

export const SI_NO = [
  { value: 'Sí', aliases: ['si', 'sí', 's', 'claro', 'si tengo', 'afirmativo', 'yes'] },
  { value: 'No', aliases: ['no', 'n', 'no tengo', 'negativo'] },
];

export const CANALES = [
  { value: 'Eventos', aliases: ['evento', 'feria', 'charla', 'taller'] },
  { value: 'Redes sociales', aliases: ['redes', 'facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'twitter', 'youtube'] },
  { value: 'Página web', aliases: ['web', 'internet', 'google', 'pagina', 'pagina web de bancoldex'] },
  { value: 'Entidad financiera', aliases: ['banco', 'cooperativa', 'entidad'] },
  { value: 'Referido', aliases: ['amigo', 'familiar', 'conocido', 'recomendacion', 'referido'] },
  { value: 'Medios de comunicación', aliases: ['radio', 'television', 'tv', 'prensa', 'periodico', 'noticias'] },
  { value: 'Otro', aliases: ['otro', 'otra'] },
];

export const MEDIOS_CONTACTO = [
  { value: 'WhatsApp', aliases: ['whatsapp', 'wasap', 'wpp', 'whats', 'ws'] },
  { value: 'Llamada', aliases: ['llamada', 'llamar', 'telefono', 'celular', 'llamada telefonica'] },
  { value: 'Correo electrónico', aliases: ['correo', 'email', 'mail', 'e-mail', 'correo electronico'] },
];

// Departamento → municipios principales (se usan como sugerencias, no como lista cerrada).
export const DEPARTAMENTOS = {
  'Amazonas': ['Leticia', 'Puerto Nariño'],
  'Antioquia': ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Rionegro', 'Apartadó'],
  'Arauca': ['Arauca', 'Saravena', 'Tame'],
  'Atlántico': ['Barranquilla', 'Soledad', 'Malambo', 'Puerto Colombia'],
  'Bogotá D.C.': ['Bogotá'],
  'Bolívar': ['Cartagena', 'Magangué', 'Turbaco'],
  'Boyacá': ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá'],
  'Caldas': ['Manizales', 'La Dorada', 'Chinchiná'],
  'Caquetá': ['Florencia', 'San Vicente del Caguán'],
  'Casanare': ['Yopal', 'Aguazul'],
  'Cauca': ['Popayán', 'Santander de Quilichao'],
  'Cesar': ['Valledupar', 'Aguachica'],
  'Chocó': ['Quibdó', 'Istmina'],
  'Córdoba': ['Montería', 'Lorica', 'Sahagún'],
  'Cundinamarca': ['Soacha', 'Chía', 'Zipaquirá', 'Facatativá', 'Fusagasugá', 'Girardot'],
  'Guainía': ['Inírida'],
  'Guaviare': ['San José del Guaviare'],
  'Huila': ['Neiva', 'Pitalito', 'Garzón'],
  'La Guajira': ['Riohacha', 'Maicao'],
  'Magdalena': ['Santa Marta', 'Ciénaga'],
  'Meta': ['Villavicencio', 'Acacías', 'Granada'],
  'Nariño': ['Pasto', 'Ipiales', 'Tumaco'],
  'Norte de Santander': ['Cúcuta', 'Ocaña', 'Pamplona'],
  'Putumayo': ['Mocoa', 'Puerto Asís'],
  'Quindío': ['Armenia', 'Calarcá'],
  'Risaralda': ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal'],
  'San Andrés y Providencia': ['San Andrés', 'Providencia'],
  'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja'],
  'Sucre': ['Sincelejo', 'Corozal'],
  'Tolima': ['Ibagué', 'Espinal', 'Honda'],
  'Valle del Cauca': ['Cali', 'Palmira', 'Jamundí', 'Yumbo', 'Tuluá', 'Buga', 'Cartago', 'Buenaventura'],
  'Vaupés': ['Mitú'],
  'Vichada': ['Puerto Carreño'],
};

export const DEPARTAMENTO_ALIASES = {
  'valle': 'Valle del Cauca',
  'bogota': 'Bogotá D.C.',
  'bogota dc': 'Bogotá D.C.',
  'distrito capital': 'Bogotá D.C.',
  'guajira': 'La Guajira',
  'san andres': 'San Andrés y Providencia',
  'norte santander': 'Norte de Santander',
};

export const DEPARTAMENTOS_FRECUENTES = [
  'Valle del Cauca', 'Antioquia', 'Bogotá D.C.', 'Cundinamarca', 'Atlántico', 'Santander',
];

// Subconjunto de códigos CIIU Rev. 4 A.C. frecuentes en microempresas.
// `corto` se usa en los botones de sugerencia; `palabras` ayuda a encontrar el código por descripción.
export const CIIU = [
  { codigo: '0123', descripcion: 'Cultivo de café', corto: 'Cultivo de café', palabras: 'cafe cafetero finca cafetal' },
  { codigo: '0122', descripcion: 'Cultivo de plátano y banano', corto: 'Cultivo de plátano', palabras: 'platano banano' },
  { codigo: '0141', descripcion: 'Cría de ganado bovino y bufalino', corto: 'Ganadería', palabras: 'ganado vacas ganaderia bovino leche' },
  { codigo: '0145', descripcion: 'Cría de aves de corral', corto: 'Cría de pollos o gallinas', palabras: 'pollos gallinas huevos aves galpon avicola' },
  { codigo: '1011', descripcion: 'Procesamiento y conservación de carne y productos cárnicos', corto: 'Procesamiento de carnes', palabras: 'carne embutidos chorizo salchicha carnicos' },
  { codigo: '1081', descripcion: 'Elaboración de productos de panadería', corto: 'Panadería', palabras: 'panaderia pan pasteleria reposteria tortas ponques' },
  { codigo: '1082', descripcion: 'Elaboración de cacao, chocolate y productos de confitería', corto: 'Chocolates y dulces', palabras: 'chocolate cacao dulces confiteria' },
  { codigo: '1089', descripcion: 'Elaboración de otros productos alimenticios n.c.p.', corto: 'Otros alimentos procesados', palabras: 'alimentos arepas empanadas conservas salsas snacks' },
  { codigo: '1410', descripcion: 'Confección de prendas de vestir, excepto prendas de piel', corto: 'Confección de ropa', palabras: 'confeccion ropa costura modisteria taller textil prendas uniformes' },
  { codigo: '1521', descripcion: 'Fabricación de calzado de cuero y piel, con cualquier tipo de suela', corto: 'Fabricación de calzado', palabras: 'zapatos calzado cuero zapateria fabricacion' },
  { codigo: '1811', descripcion: 'Actividades de impresión', corto: 'Imprenta', palabras: 'imprenta impresion litografia estampado' },
  { codigo: '2620', descripcion: 'Fabricación de computadoras y de equipo periférico', corto: 'Fabricación de computadores', palabras: 'computadores computadoras ensamble hardware perifericos' },
  { codigo: '3110', descripcion: 'Fabricación de muebles', corto: 'Fabricación de muebles', palabras: 'muebles carpinteria ebanisteria madera' },
  { codigo: '4330', descripcion: 'Terminación y acabado de edificios y obras de ingeniería civil', corto: 'Acabados de construcción', palabras: 'construccion acabados pintura drywall enchape remodelacion obra' },
  { codigo: '4520', descripcion: 'Mantenimiento y reparación de vehículos automotores', corto: 'Taller mecánico', palabras: 'taller mecanico mecanica carros vehiculos reparacion latoneria' },
  { codigo: '4530', descripcion: 'Comercio de partes, piezas (autopartes) y accesorios (lujos) para vehículos automotores', corto: 'Venta de autopartes', palabras: 'autopartes repuestos lujos accesorios carros' },
  { codigo: '4541', descripcion: 'Comercio de motocicletas y de sus partes, piezas y accesorios', corto: 'Motos y repuestos', palabras: 'motos motocicletas repuestos moto' },
  { codigo: '4631', descripcion: 'Comercio al por mayor de productos alimenticios', corto: 'Venta mayorista de alimentos', palabras: 'mayorista distribuidora alimentos por mayor' },
  { codigo: '4711', descripcion: 'Comercio al por menor en establecimientos no especializados con surtido compuesto principalmente por alimentos, bebidas o tabaco', corto: 'Tienda de barrio o minimercado', palabras: 'tienda barrio minimercado supermercado abarrotes viveres granero mercado' },
  { codigo: '4719', descripcion: 'Comercio al por menor en establecimientos no especializados, con surtido compuesto principalmente por productos diferentes de alimentos (víveres en general), bebidas y tabaco', corto: 'Variedades o miscelánea', palabras: 'miscelanea variedades cacharreria bazar' },
  { codigo: '4721', descripcion: 'Comercio al por menor de productos agrícolas para el consumo en establecimientos especializados', corto: 'Frutas y verduras', palabras: 'fruver frutas verduras legumbres' },
  { codigo: '4723', descripcion: 'Comercio al por menor de carnes (incluye aves de corral), productos cárnicos, pescados y productos de mar, en establecimientos especializados', corto: 'Carnicería o pescadería', palabras: 'carniceria pescaderia pollo fama carne pescado' },
  { codigo: '4741', descripcion: 'Comercio al por menor de computadores, equipos periféricos, programas de informática y equipos de telecomunicaciones en establecimientos especializados', corto: 'Venta de tecnología y celulares', palabras: 'celulares computadores tecnologia accesorios electronica telefonos' },
  { codigo: '4751', descripcion: 'Comercio al por menor de productos textiles en establecimientos especializados', corto: 'Venta de telas', palabras: 'telas textiles' },
  { codigo: '4752', descripcion: 'Comercio al por menor de artículos de ferretería, pinturas y productos de vidrio en establecimientos especializados', corto: 'Ferretería', palabras: 'ferreteria herramientas pinturas vidrios materiales' },
  { codigo: '4771', descripcion: 'Comercio al por menor de prendas de vestir y sus accesorios (incluye artículos de piel) en establecimientos especializados', corto: 'Venta de ropa', palabras: 'ropa boutique almacen prendas vestir accesorios' },
  { codigo: '4772', descripcion: 'Comercio al por menor de todo tipo de calzado y artículos de cuero y sucedáneos del cuero en establecimientos especializados', corto: 'Venta de calzado', palabras: 'zapatos calzado venta zapateria bolsos' },
  { codigo: '4773', descripcion: 'Comercio al por menor de productos farmacéuticos y medicinales, cosméticos y artículos de tocador en establecimientos especializados', corto: 'Droguería o cosméticos', palabras: 'drogueria farmacia cosmeticos maquillaje belleza productos' },
  { codigo: '4921', descripcion: 'Transporte de pasajeros', corto: 'Transporte de pasajeros', palabras: 'taxi transporte pasajeros buseta van' },
  { codigo: '4923', descripcion: 'Transporte de carga por carretera', corto: 'Transporte de carga', palabras: 'carga camion acarreos trasteos fletes' },
  { codigo: '5511', descripcion: 'Alojamiento en hoteles', corto: 'Hotel u hospedaje', palabras: 'hotel hospedaje hostal alojamiento' },
  { codigo: '5611', descripcion: 'Expendio a la mesa de comidas preparadas', corto: 'Restaurante', palabras: 'restaurante almuerzos corrientazo comida asadero' },
  { codigo: '5613', descripcion: 'Expendio de comidas preparadas en cafeterías', corto: 'Cafetería', palabras: 'cafeteria cafe tinto panaderia cafe' },
  { codigo: '5619', descripcion: 'Otros tipos de expendio de comidas preparadas n.c.p.', corto: 'Comidas rápidas', palabras: 'comidas rapidas hamburguesas perros pizza empanadas puesto' },
  { codigo: '6201', descripcion: 'Actividades de desarrollo de sistemas informáticos (planificación, análisis, diseño, programación, pruebas)', corto: 'Desarrollo de software', palabras: 'software desarrollo programacion paginas web aplicaciones sistemas' },
  { codigo: '7310', descripcion: 'Publicidad', corto: 'Publicidad', palabras: 'publicidad marketing agencia' },
  { codigo: '7410', descripcion: 'Actividades especializadas de diseño', corto: 'Diseño', palabras: 'diseno grafico interiores moda' },
  { codigo: '8559', descripcion: 'Otros tipos de educación n.c.p.', corto: 'Cursos o academia', palabras: 'cursos academia clases tutorias educacion' },
  { codigo: '9511', descripcion: 'Mantenimiento y reparación de computadores y de equipo periférico', corto: 'Reparación de computadores', palabras: 'reparacion computadores mantenimiento tecnico' },
  { codigo: '9601', descripcion: 'Lavado y limpieza, incluso la limpieza en seco, de productos textiles y de piel', corto: 'Lavandería', palabras: 'lavanderia lavado ropa tintoreria' },
  { codigo: '9602', descripcion: 'Peluquería y otros tratamientos de belleza', corto: 'Peluquería o barbería', palabras: 'peluqueria barberia salon belleza unas manicure estetica' },
  { codigo: '9609', descripcion: 'Otras actividades de servicios personales n.c.p.', corto: 'Otros servicios personales', palabras: 'servicios personales' },
];

export const CIIU_FRECUENTES = ['4711', '5611', '9602', '1410', '4771', '5619'];

export const LINKS = {
  politicaDatos: process.env.POLICY_URL
    || 'https://www.bancoldex.com/sites/default/files/politica_de_tratamiento_de_datos_personales_para_internet.pdf',
  terminos: process.env.TERMS_URL || 'https://neocredito.bancoldex.com/neocredito/home',
};
