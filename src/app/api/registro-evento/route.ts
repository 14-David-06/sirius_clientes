import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// ─── Config ──────────────────────────────────────────────────────────────────
const API_KEY = process.env.API_KEY_SIRIUS_ASISTENCIA_EVENTO!;
const BASE_ID = process.env.ASISTENCIA_EVENTO_BASE_ID!;
const PRODUCTORES_TABLE = process.env.ASISTENCIA_EVENTO_PRODUCTORES_TABLE_ID!;
const FIRMA_SECRET = process.env.ASISTENCIA_EVENTO_FIRMA_SECRET!;

const PROD_URL = `https://api.airtable.com/v0/${BASE_ID}/${PRODUCTORES_TABLE}`;

const FIELDS = {
  nombre:           process.env.ASISTENCIA_EVENTO_PROD_NOMBRE_FIELD_ID!,
  apellidos:        process.env.ASISTENCIA_EVENTO_PROD_APELLIDOS_FIELD_ID!,
  telefono:         process.env.ASISTENCIA_EVENTO_PROD_TELEFONO_FIELD_ID!,
  numeroDocumento:  process.env.ASISTENCIA_EVENTO_PROD_DOCUMENTO_FIELD_ID!,
  direccion:        process.env.ASISTENCIA_EVENTO_PROD_DIRECCION_FIELD_ID!,
  correo:           process.env.ASISTENCIA_EVENTO_PROD_EMAIL_FIELD_ID!,
  asociacionVinculada: process.env.ASISTENCIA_EVENTO_PROD_ASOC_NOMBRE_FIELD_ID!,
  cultivo:          process.env.ASISTENCIA_EVENTO_PROD_CULTIVO_FIELD_ID!,
  hectareas:        process.env.ASISTENCIA_EVENTO_PROD_HECTAREAS_FIELD_ID!,
  firma:            process.env.ASISTENCIA_EVENTO_PROD_FIRMA_FIELD_ID!,
};

const airtableHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

// ─── AES-256-GCM server-side encryption ──────────────────────────────────────
function encryptAES256GCM(plainText: string, password: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes
  // Pack: salt(16) + iv(12) + authTag(16) + ciphertext
  const packed = Buffer.concat([salt, iv, authTag, encrypted]);
  return packed.toString('base64');
}

// ─── POST handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      nombre,
      apellidos,
      telefono,
      numeroDocumento,
      direccion,
      correo,
      nombreAsociacion,
      cultivo,
      hectareas,
      firma,
    } = body;

    // Build fields object using field IDs
    const fields: Record<string, unknown> = {};

    if (nombre)           fields[FIELDS.nombre] = nombre;
    if (apellidos)        fields[FIELDS.apellidos] = apellidos;
    if (telefono)         fields[FIELDS.telefono] = telefono;
    if (numeroDocumento)  fields[FIELDS.numeroDocumento] = numeroDocumento;
    if (direccion)        fields[FIELDS.direccion] = direccion;
    if (correo)           fields[FIELDS.correo] = correo;
    if (cultivo)          fields[FIELDS.cultivo] = cultivo;
    if (hectareas)        fields[FIELDS.hectareas] = parseFloat(hectareas);

    // Asociación: campo de texto simple (no linked record)
    if (nombreAsociacion?.trim()) {
      fields[FIELDS.asociacionVinculada] = nombreAsociacion.trim();
    }

    // Firma: cifrar en servidor con clave fija y enviar solo el valor encriptado
    if (firma) {
      fields[FIELDS.firma] = encryptAES256GCM(firma, FIRMA_SECRET);
    }

    const response = await fetch(PROD_URL, {
      method: 'POST',
      headers: airtableHeaders,
      body: JSON.stringify({ records: [{ fields }], typecast: true }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Airtable error:', error);
      return NextResponse.json(
        { error: 'Error al guardar el registro en Airtable', details: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, record: data.records[0] }, { status: 201 });

  } catch (error) {
    console.error('Error en registro-evento:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
