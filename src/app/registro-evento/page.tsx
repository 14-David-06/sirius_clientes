'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';

// ─── Signature Pad Component ─────────────────────────────────────────────────

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
}

function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  // Fix: scale mouse/touch coordinates to match the internal canvas resolution
  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e instanceof TouchEvent) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPos.current = getPos(e, canvas);
    e.preventDefault();
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (lastPos.current) {
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
    }
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    e.preventDefault();
  }, []);

  const stopDrawing = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      setHasSignature(true);
      onChange(canvas.toDataURL('image/png'));
    }
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange(null);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-white text-opacity-90 mb-2">
        Firma digital <span className="text-red-400">*</span>
      </label>
      <div className="relative border-2 border-dashed border-white border-opacity-30 rounded-lg bg-white hover:border-green-400 transition-colors">
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full h-[180px] rounded-lg cursor-crosshair touch-none bg-white"
        />
        {!hasSignature && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 pointer-events-none">
            Dibuje su firma aquí
          </p>
        )}
      </div>
      {hasSignature && (
        <button
          type="button"
          onClick={clear}
          className="mt-3 flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-500 bg-opacity-20 border border-red-400 border-opacity-30 text-red-300 text-xs font-medium hover:bg-opacity-40 hover:text-red-200 transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Limpiar firma
        </button>
      )}
    </div>
  );
}

// ─── Voice Recognition Hook ──────────────────────────────────────────────────

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ─── Main Form ────────────────────────────────────────────────────────────────

interface FormState {
  nombre: string;
  apellidos: string;
  telefono: string;
  numeroDocumento: string;
  direccion: string;
  correo: string;
  nombreAsociacion: string;
  cultivo: string;
  hectareas: string;
  firma: string | null;
}

const INITIAL_STATE: FormState = {
  nombre: '',
  apellidos: '',
  telefono: '',
  numeroDocumento: '',
  direccion: '',
  correo: '',
  nombreAsociacion: '',
  cultivo: '',
  hectareas: '',
  firma: null,
};

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function RegistroEventoPage() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [aceptaPolitica, setAceptaPolitica] = useState(false);
  const [errorPolitica, setErrorPolitica] = useState(false);

  // ─── Voice state ────────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    setSpeechSupported(
      typeof window !== 'undefined' &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }, []);

  const startListening = useCallback(() => {
    if (!speechSupported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setVoiceTranscript(finalTranscript + interim);
    };

    recognition.onerror = (evt: any) => {
      // Only stop on fatal errors, not on no-speech
      if (evt.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart to keep listening longer (browser cuts off ~60s)
      if (isListeningRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          return;
        } catch {
          // ignore if already started
        }
      }
      setIsListening(false);
      if (finalTranscript.trim()) {
        processTranscript(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    isListeningRef.current = true;
    setVoiceTranscript('');
  }, [speechSupported]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const processTranscript = async (text: string) => {
    setVoiceProcessing(true);
    try {
      const res = await fetch('/api/process-voice-evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          setForm((prev) => ({
            ...prev,
            nombre: data.nombre || prev.nombre,
            apellidos: data.apellidos || prev.apellidos,
            telefono: data.telefono || prev.telefono,
            numeroDocumento: data.numeroDocumento || prev.numeroDocumento,
            direccion: data.direccion || prev.direccion,
            correo: data.correo || prev.correo,
            nombreAsociacion: data.nombreAsociacion || prev.nombreAsociacion,
            cultivo: data.cultivo || prev.cultivo,
            hectareas: data.hectareas ? String(data.hectareas) : prev.hectareas,
          }));
          setErrors({});
        }
      }
    } catch {
      // silent
    } finally {
      setVoiceProcessing(false);
    }
  };

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.nombre.trim()) newErrors.nombre = 'El nombre es requerido';
    if (!form.apellidos.trim()) newErrors.apellidos = 'Los apellidos son requeridos';
    if (!form.telefono.trim()) newErrors.telefono = 'El teléfono es requerido';
    if (!form.numeroDocumento.trim()) newErrors.numeroDocumento = 'El número de documento es requerido';
    if (!form.direccion.trim()) newErrors.direccion = 'La dirección es requerida';
    if (form.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) {
      newErrors.correo = 'Ingrese un correo válido';
    }
    if (form.hectareas && isNaN(parseFloat(form.hectareas))) {
      newErrors.hectareas = 'Ingrese un número válido';
    }
    if (!form.firma) newErrors.firma = 'La firma digital es requerida';

    if (!aceptaPolitica) setErrorPolitica(true);

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && aceptaPolitica;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/registro-evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al enviar el formulario');
      }

      setStatus('success');
      setForm(INITIAL_STATE);
      setAceptaPolitica(false);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado');
    }
  };

  // ─── Success screen ────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div
        className="min-h-screen relative"
        style={{
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752096905/DSC_4163_spt7fv.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        <div className="relative z-10 flex items-center justify-center min-h-screen p-4 pt-28">
          <div className="bg-black bg-opacity-30 backdrop-blur-md rounded-2xl shadow-2xl border border-white border-opacity-20 p-10 max-w-md w-full text-center transform hover:scale-105 transition-all duration-300">
            <div className="w-16 h-16 bg-green-500 bg-opacity-30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">¡Registro exitoso!</h2>
            <p className="text-white text-opacity-80 mb-6">
              Su información ha sido guardada correctamente. Gracias por participar.
            </p>
            <Button
              onClick={() => setStatus('idle')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3"
            >
              Registrar otro productor
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752096905/DSC_4163_spt7fv.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-50"></div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-28 pb-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-black bg-opacity-30 backdrop-blur-md shadow-2xl rounded-xl border border-white border-opacity-20 p-8 transform hover:scale-105 transition-all duration-300">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-500 bg-opacity-30 rounded-2xl mb-4">
              <svg className="w-7 h-7 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 drop-shadow-lg">
              Registro de Productores
            </h1>
            <p className="text-white text-opacity-80 drop-shadow-md">
              Sirius Asistencia Eventos
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-black bg-opacity-30 backdrop-blur-md rounded-2xl shadow-2xl border border-white border-opacity-20 p-6 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">

            {/* Voice input */}
            <section>
              <h2 className="text-base font-semibold text-green-300 mb-4 pb-2 border-b border-white border-opacity-10 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Dictado por voz
              </h2>
              <p className="text-white text-opacity-60 text-xs mb-3">
                Presione el micrófono y dicte sus datos. Ejemplo: &quot;Mi nombre es Carlos Rodríguez, cédula 1234567890, teléfono 3001234567, vivo en Vereda El Porvenir, cultivo café, tengo 5 hectáreas&quot;
              </p>
              <div className="flex items-center gap-3">
                {speechSupported ? (
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    disabled={voiceProcessing}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 shadow-lg ${
                      isListening
                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                        : voiceProcessing
                        ? 'bg-yellow-600 text-white cursor-wait'
                        : 'bg-green-600 hover:bg-green-700 text-white transform hover:scale-105'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                        Detener
                      </>
                    ) : voiceProcessing ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        Dictar datos
                      </>
                    )}
                  </button>
                ) : (
                  <p className="text-yellow-300 text-xs">⚠️ Su navegador no soporta reconocimiento de voz.</p>
                )}
              </div>
              {/* Listening indicator */}
              {isListening && (
                <div className="mt-3 bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg p-3 flex items-center gap-2">
                  <span className="animate-pulse text-green-400 text-lg">●</span>
                  <p className="text-white text-opacity-90 text-sm font-medium">Escuchando...</p>
                </div>
              )}
            </section>

            {/* Personal data */}
            <section>
              <h2 className="text-base font-semibold text-green-300 mb-4 pb-2 border-b border-white border-opacity-10 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Datos personales
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white text-opacity-90 mb-2">Nombre <span className="text-red-400">*</span></label>
                  <input
                    placeholder="Ej: Carlos"
                    value={form.nombre}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    className={`w-full h-10 rounded-lg border bg-white bg-opacity-10 text-white placeholder:text-white placeholder:text-opacity-40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.nombre ? 'border-red-500' : 'border-white border-opacity-20'}`}
                  />
                  {errors.nombre && <p className="mt-1 text-sm text-red-400">{errors.nombre}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-white text-opacity-90 mb-2">Apellidos <span className="text-red-400">*</span></label>
                  <input
                    placeholder="Ej: Rodríguez López"
                    value={form.apellidos}
                    onChange={(e) => handleChange('apellidos', e.target.value)}
                    className={`w-full h-10 rounded-lg border bg-white bg-opacity-10 text-white placeholder:text-white placeholder:text-opacity-40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.apellidos ? 'border-red-500' : 'border-white border-opacity-20'}`}
                  />
                  {errors.apellidos && <p className="mt-1 text-sm text-red-400">{errors.apellidos}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-white text-opacity-90 mb-2">Número de documento <span className="text-red-400">*</span></label>
                  <input
                    placeholder="Ej: 1234567890"
                    value={form.numeroDocumento}
                    onChange={(e) => handleChange('numeroDocumento', e.target.value)}
                    className={`w-full h-10 rounded-lg border bg-white bg-opacity-10 text-white placeholder:text-white placeholder:text-opacity-40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.numeroDocumento ? 'border-red-500' : 'border-white border-opacity-20'}`}
                  />
                  {errors.numeroDocumento && <p className="mt-1 text-sm text-red-400">{errors.numeroDocumento}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-white text-opacity-90 mb-2">Teléfono <span className="text-red-400">*</span></label>
                  <input
                    type="tel"
                    placeholder="Ej: 3001234567"
                    value={form.telefono}
                    onChange={(e) => handleChange('telefono', e.target.value)}
                    className={`w-full h-10 rounded-lg border bg-white bg-opacity-10 text-white placeholder:text-white placeholder:text-opacity-40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.telefono ? 'border-red-500' : 'border-white border-opacity-20'}`}
                  />
                  {errors.telefono && <p className="mt-1 text-sm text-red-400">{errors.telefono}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-white text-opacity-90 mb-2">Correo electrónico</label>
                  <input
                    type="email"
                    placeholder="Ej: productor@correo.com"
                    value={form.correo}
                    onChange={(e) => handleChange('correo', e.target.value)}
                    className={`w-full h-10 rounded-lg border bg-white bg-opacity-10 text-white placeholder:text-white placeholder:text-opacity-40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.correo ? 'border-red-500' : 'border-white border-opacity-20'}`}
                  />
                  {errors.correo && <p className="mt-1 text-sm text-red-400">{errors.correo}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-white text-opacity-90 mb-2">Dirección <span className="text-red-400">*</span></label>
                  <textarea
                    placeholder="Ej: Vereda El Porvenir, Finca La Esperanza"
                    value={form.direccion}
                    onChange={(e) => handleChange('direccion', e.target.value)}
                    rows={2}
                    className={`w-full rounded-lg border bg-white bg-opacity-10 text-white placeholder:text-white placeholder:text-opacity-40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none ${errors.direccion ? 'border-red-500' : 'border-white border-opacity-20'}`}
                  />
                  {errors.direccion && <p className="mt-1 text-sm text-red-400">{errors.direccion}</p>}
                </div>
              </div>
            </section>

            {/* Farm data */}
            <section>
              <h2 className="text-base font-semibold text-green-300 mb-4 pb-2 border-b border-white border-opacity-10 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
                Información agrícola
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white text-opacity-90 mb-2">Nombre de la asociación</label>
                  <input
                    placeholder="Ej: Asocafé Eje Cafetero"
                    value={form.nombreAsociacion}
                    onChange={(e) => handleChange('nombreAsociacion', e.target.value)}
                    className="w-full h-10 rounded-lg border border-white border-opacity-20 bg-white bg-opacity-10 text-white placeholder:text-white placeholder:text-opacity-40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white text-opacity-90 mb-2">Cultivo</label>
                  <input
                    placeholder="Ej: Café, Maíz, Caña"
                    value={form.cultivo}
                    onChange={(e) => handleChange('cultivo', e.target.value)}
                    className="w-full h-10 rounded-lg border border-white border-opacity-20 bg-white bg-opacity-10 text-white placeholder:text-white placeholder:text-opacity-40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white text-opacity-90 mb-2">Cantidad de hectáreas</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej: 5.50"
                    value={form.hectareas}
                    onChange={(e) => handleChange('hectareas', e.target.value)}
                    className={`w-full h-10 rounded-lg border bg-white bg-opacity-10 text-white placeholder:text-white placeholder:text-opacity-40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.hectareas ? 'border-red-500' : 'border-white border-opacity-20'}`}
                  />
                  {errors.hectareas && <p className="mt-1 text-sm text-red-400">{errors.hectareas}</p>}
                </div>
              </div>
            </section>

            {/* Signature */}
            <section>
              <h2 className="text-base font-semibold text-green-300 mb-4 pb-2 border-b border-white border-opacity-10 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Firma digital
              </h2>
              <SignaturePad onChange={(val) => {
                setForm((prev) => ({ ...prev, firma: val }));
                if (val && errors.firma) setErrors((prev) => ({ ...prev, firma: undefined }));
              }} />
              {errors.firma && <p className="mt-1 text-sm text-red-400">{errors.firma}</p>}
            </section>

            {/* AI Disclaimer */}
            <div className="bg-yellow-500 bg-opacity-10 border border-yellow-400 border-opacity-30 rounded-lg p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-yellow-200 text-xs leading-relaxed">
                <span className="font-semibold">Nota:</span> Si utilizó el dictado por voz, la IA puede cometer errores en la transcripción. Por favor <span className="font-semibold text-yellow-100">verifique todos sus datos</span> antes de enviar el formulario.
              </p>
            </div>

            {/* Data Protection Checkbox - Ley 1581 de 2012 */}
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={aceptaPolitica}
                  onChange={(e) => {
                    setAceptaPolitica(e.target.checked);
                    if (e.target.checked) setErrorPolitica(false);
                  }}
                  className="mt-1 h-4 w-4 rounded border-white border-opacity-30 bg-white bg-opacity-10 text-green-500 focus:ring-green-500 focus:ring-offset-0 cursor-pointer flex-shrink-0"
                />
                <span className="text-white text-opacity-80 text-xs leading-relaxed group-hover:text-opacity-100 transition-colors">
                  Autorizo de manera voluntaria, previa, explícita e informada a <span className="font-semibold text-green-300">Sirius Regenerative Solutions S.A.S</span> para recolectar, almacenar, usar y tratar mis datos personales de acuerdo con la <span className="font-semibold text-green-300">Ley 1581 de 2012</span> y el <span className="font-semibold text-green-300">Decreto 1377 de 2013</span> de Protección de Datos Personales de Colombia. Declaro que he sido informado(a) sobre mis derechos a conocer, actualizar, rectificar y suprimir mis datos, así como a revocar esta autorización.
                </span>
              </label>
              {errorPolitica && (
                <p className="text-sm text-red-400 ml-7">Debe aceptar la política de tratamiento de datos para continuar.</p>
              )}
            </div>

            {/* Error banner */}
            {status === 'error' && (
              <div className="bg-red-500 bg-opacity-20 border border-red-400 border-opacity-40 rounded-lg p-3 text-sm text-red-200">
                {errorMsg}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={status === 'loading'}
              className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700 text-white shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              {status === 'loading' ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Enviando...
                </span>
              ) : (
                'Registrar productor'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-white text-opacity-50 mt-6">
          © {new Date().getFullYear()} Sirius Regenerative Solutions S.A.S ZOMAC
        </p>
      </div>
    </div>
  );
}
