"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertTriangle, Camera, ArrowRight, ArrowLeft, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CHECKLIST = [
  {
    title: "1. Compartimento del Motor",
    items: [
      "Nivel de Aceite de motor",
      "Nivel de Refrigerante (coolant)",
      "Nivel de Líquido de dirección asistida",
      "Nivel de Líquido lavaparabrisas",
      "Bandas/Correas: Alternador (tensión y desgaste)",
      "Bandas/Correas: Bomba de agua (tensión y desgaste)",
      "Bandas/Correas: Compresor de aire",
      "Mangueras de líquido: Sin fugas ni cortes",
      "Mangueras de aire: Sin fugas ni cortes",
      "Alternador: Montado firmemente, cables bien conectados",
      "Bomba de Agua: Montada firmemente, sin fugas",
      "Compresor de Aire: Montado firmemente, sin fugas audibles",
      "Caja de dirección (Steering box): Montada firmemente, sin fugas",
      "Varillaje de dirección (Pitman arm, tie rod): Seguro, sin dobleces"
    ]
  },
  {
    title: "2. Suspensión, Frenos y Llantas Delanteras",
    items: [
      "Ballestas (Leaf springs): Sin hojas rotas o desplazadas",
      "Soportes de suspensión (U-bolts): Seguros y firmes",
      "Amortiguador (Shock absorber): Seguro, sin fugas",
      "Mangueras/Líneas de freno delantero: Sin fugas ni cortes",
      "Cámara de freno (Brake chamber) delantera: Firme, sin abolladuras",
      "Ajustador de tensión (Slack adjuster) delantero: Ángulo correcto",
      "Tambor/Disco de freno delantero: Sin grietas ni grasa",
      "Balatas (Brake linings) delanteras: Grosor > 1/4 pulg",
      "Banda de rodadura (Llantas delanteras): Profundidad > 4/32 pulg",
      "Presión de aire (Llantas delanteras): 100-110 PSI",
      "Paredes laterales (Llantas delanteras): Sin cortes ni protuberancias",
      "Rines delanteros: Sin grietas ni soldaduras",
      "Tuercas (Lug nuts) delanteras: Todas presentes, sin óxido",
      "Cubo de la rueda (Hub oil seal): Nivel correcto, sin fugas"
    ]
  },
  {
    title: "3. Lateral y Cabina (Exterior)",
    items: [
      "Espejos: Limpios, montados firmemente",
      "Parabrisas: Limpio, sin grietas obstructivas",
      "Puertas: Abren/cierran bien, sellos intactos",
      "Tanque de Combustible: Tapa asegurada, sin fugas",
      "Tanque de DEF: Tapa asegurada, sin fugas",
      "Baterías: Caja segura",
      "Conexiones de batería: Limpias, sin corrosión",
      "Luces direccionales y emergencias (Exterior): Funcionando",
      "Faros principales (Altas/Bajas): Funcionando",
      "Sistema de Escape: Firme, sin hollín negro (fugas)"
    ]
  },
  {
    title: "4. Quinta Rueda / Acoplamiento",
    items: [
      "Línea de aire de emergencia (Roja): Sin fugas ni rozaduras",
      "Línea de aire de servicio (Azul): Sin fugas ni rozaduras",
      "Cable eléctrico (Verde): Seguro, sin cortes",
      "Glad hands (Conectores): Sellos de goma intactos",
      "Plataforma de quinta rueda: Acoplada y lubricada",
      "Mordazas (Locking jaws): Completamente cerradas",
      "Palanca de liberación: En posición de bloqueo"
    ]
  },
  {
    title: "5. Ejes Traseros (Camión)",
    items: [
      "Suspensión trasera: Muelle/Air bags sanos, sin fugas",
      "Frenos traseros: Cámaras, mangueras y tambores OK",
      "Banda de rodadura (Llantas traseras): Profundidad > 2/32 pulg",
      "Espacio entre llantas gemelas: Sin rocas ni contacto",
      "Rines y Tuercas traseras: Seguros, sin grietas",
      "Guardabarros (Mud flaps): Firmes, altura reglamentaria"
    ]
  },
  {
    title: "6. Remolque (Trailer)",
    items: [
      "Laterales y Piso: Sin daños estructurales",
      "Travesaños inferiores: Intactos",
      "Tren de aterrizaje (Landing Gear): Levantado, manivela asegurada",
      "Suspensión y Frenos del remolque: OK",
      "Llantas del remolque: Profundidad > 2/32 pulg",
      "Puertas traseras / Amarres: Asegurados",
      "Luces traseras (Freno, marcha, direccionales): Funcionando",
      "Cinta reflectiva (DOT tape): Limpia y visible"
    ]
  },
  {
    title: "7. Cabina y Prueba de Frenos",
    items: [
      "Extintor de incendios: Cargado y en zona verde",
      "Triángulos reflectivos: 3 presentes",
      "Cinturón de Seguridad: Abrocha bien, sin daños",
      "Limpiaparabrisas y líquido: Funcionando",
      "Claxon (Eléctrico y de aire): Funcionando",
      "Calefacción y Desempañador: Funcionando",
      "Prueba Fuga de Aire (Paso 1): < 4 PSI/min (motor apagado, frenos sueltos)",
      "Alarma Baja Presión (Paso 2): Activa a los 60 PSI",
      "Bloqueo Válvulas Pop-out (Paso 3): Saltan entre 20-45 PSI",
      "Freno de Estacionamiento (Camión): Retiene el vehículo",
      "Freno de Estacionamiento (Remolque): Retiene el vehículo",
      "Freno de Servicio: Frena derecho a 5 mph"
    ]
  }
];

type ItemStatus = 'pass' | 'defect' | null;

interface DefectDetails {
  critical: boolean;
  note: string;
}

export default function PreTripInspection() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  
  const [itemStatuses, setItemStatuses] = useState<Record<number, Record<number, ItemStatus>>>({});
  const [defectDetails, setDefectDetails] = useState<Record<number, Record<number, DefectDetails>>>({});

  const section = CHECKLIST[currentStep];
  
  const isSectionComplete = () => {
    const statuses = itemStatuses[currentStep] || {};
    for (let i = 0; i < section.items.length; i++) {
      if (!statuses[i]) return false;
      if (statuses[i] === 'defect') {
        const details = defectDetails[currentStep]?.[i];
        if (!details || !details.note.trim()) return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (!isSectionComplete()) {
      alert('Please review all items in this section and provide notes for any defects before proceeding.');
      return;
    }

    if (currentStep < CHECKLIST.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    } else {
      // Final submission
      let hasCritical = false;
      const allDefects: any[] = [];
      Object.keys(defectDetails).forEach(sec => {
        Object.keys(defectDetails[Number(sec)]).forEach(item => {
           const def = defectDetails[Number(sec)][Number(item)];
           if (def.critical) hasCritical = true;
           allDefects.push({
              section: CHECKLIST[Number(sec)].title,
              item: CHECKLIST[Number(sec)].items[Number(item)],
              critical: def.critical,
              note: def.note
           });
        });
      });

      const driverId = localStorage.getItem('fleet_user_id');
      const status = hasCritical ? 'failed' : (allDefects.length > 0 ? 'passed_with_defect' : 'passed');

      const { error } = await supabase.from('inspections').insert([{
         driver_id: driverId,
         type: 'pre_trip',
         status: status,
         defects: allDefects,
         notes: 'Submitted via Driver App'
      }]);

      if (error) {
         alert("Error saving inspection: " + error.message);
         return;
      }

      if (hasCritical) {
        alert('INSPECTION FAILED (OUT OF SERVICE). Critical defects were reported. Vehicle cannot be dispatched. A maintenance ticket has been created.');
        router.push('/driver-app');
      } else {
        alert('INSPECTION PASSED! Pre-Trip logged successfully. Have a safe trip!');
        router.push('/driver-app');
      }
    }
  };

  const setItemStatus = (itemIndex: number, status: ItemStatus) => {
    setItemStatuses(prev => ({
      ...prev,
      [currentStep]: {
        ...(prev[currentStep] || {}),
        [itemIndex]: status
      }
    }));
  };

  const updateDefectDetails = (itemIndex: number, details: Partial<DefectDetails>) => {
    setDefectDetails(prev => ({
      ...prev,
      [currentStep]: {
        ...(prev[currentStep] || {}),
        [itemIndex]: {
          critical: prev[currentStep]?.[itemIndex]?.critical ?? false,
          note: prev[currentStep]?.[itemIndex]?.note ?? '',
          ...details
        }
      }
    }));
  };

  const passAll = () => {
    const statuses: Record<number, ItemStatus> = {};
    section.items.forEach((_, i) => statuses[i] = 'pass');
    setItemStatuses(prev => ({ ...prev, [currentStep]: statuses }));
  };

  return (
    <div className="flex flex-col min-h-full bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="bg-[#111] p-4 pt-20 flex items-center justify-between sticky top-0 z-50 border-b border-white/10 shadow-lg">
        <button onClick={() => router.push('/driver-app')} className="p-2 -ml-2 text-primary hover:bg-white/5 rounded-full transition">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-black uppercase tracking-wider flex items-center">
          <ShieldCheck className="w-5 h-5 mr-2 text-primary" /> Pre-Trip DOT
        </h1>
        <div className="text-sm font-bold text-gray-400 bg-black/50 px-3 py-1 rounded-full border border-white/5">
          {currentStep + 1} / {CHECKLIST.length}
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-white/5 w-full">
         <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((currentStep + 1) / CHECKLIST.length) * 100}%` }}></div>
      </div>

      <main className="flex-1 p-4 pb-32">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">{section.title}</h2>
          <button onClick={passAll} className="flex items-center text-xs font-bold bg-success/20 text-success border border-success/30 px-3 py-1.5 rounded-lg hover:bg-success/30 transition">
            <CheckCircle className="w-4 h-4 mr-1" /> Aprobar Todo
          </button>
        </div>

        <div className="space-y-4">
          {section.items.map((item, index) => {
            const status = itemStatuses[currentStep]?.[index];
            const isDefect = status === 'defect';
            const defectData = defectDetails[currentStep]?.[index] || { critical: false, note: '' };

            return (
              <div key={index} className={`bg-[#111] border ${isDefect ? 'border-danger/50' : status === 'pass' ? 'border-success/30' : 'border-white/10'} rounded-2xl p-4 transition-colors`}>
                <p className="font-medium text-sm mb-4">{item}</p>
                
                <div className="flex space-x-2 bg-black/50 p-1 rounded-xl">
                  <button 
                    onClick={() => setItemStatus(index, 'pass')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${status === 'pass' ? 'bg-success text-white shadow-lg shadow-green-500/20' : 'text-gray-400 hover:text-white'}`}
                  >
                    Aprobado
                  </button>
                  <button 
                    onClick={() => setItemStatus(index, 'defect')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${status === 'defect' ? 'bg-danger text-white shadow-lg shadow-red-500/20' : 'text-gray-400 hover:text-white'}`}
                  >
                    Defecto
                  </button>
                </div>

                {isDefect && (
                  <div className="mt-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-xs text-gray-400 uppercase font-bold block mb-2">Nivel de Gravedad:</label>
                    <div className="flex space-x-2 mb-4">
                      <button 
                        onClick={() => updateDefectDetails(index, { critical: false })}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${!defectData.critical ? 'bg-warning text-black border-warning' : 'border-white/20 text-gray-400'}`}
                      >
                        Menor / Taller
                      </button>
                      <button 
                        onClick={() => updateDefectDetails(index, { critical: true })}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${defectData.critical ? 'bg-danger text-white border-danger' : 'border-white/20 text-gray-400'}`}
                      >
                        Crítico (OOS)
                      </button>
                    </div>

                    <label className="text-xs text-gray-400 uppercase font-bold block mb-2">Notas Obligatorias:</label>
                    <textarea 
                      placeholder="Describe exactamente el problema..."
                      className="w-full bg-black border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-danger/50 min-h-[80px]"
                      value={defectData.note}
                      onChange={e => updateDefectDetails(index, { note: e.target.value })}
                    />

                    <button className="w-full mt-3 flex items-center justify-center py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition">
                      <Camera className="w-4 h-4 mr-2" /> Tomar Foto de Evidencia
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer / Floating Action Button */}
      <div className="sticky bottom-0 w-full p-4 pt-12 mt-auto bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent">
        <button 
          onClick={handleNext}
          disabled={!isSectionComplete()}
          className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center transition-all ${isSectionComplete() ? 'bg-primary text-white shadow-lg shadow-blue-500/30' : 'bg-white/10 text-gray-500 cursor-not-allowed'}`}
        >
          {currentStep === CHECKLIST.length - 1 ? (
             <>
                <ClipboardCheck className="w-6 h-6 mr-2" />
                Firmar y Enviar DVIR
             </>
          ) : (
             <>
                Siguiente Sección <ArrowRight className="w-5 h-5 ml-2" />
             </>
          )}
        </button>
      </div>
    </div>
  );
}
