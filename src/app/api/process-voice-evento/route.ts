import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();

    if (!transcript) {
      return NextResponse.json(
        { error: 'El texto de transcripción es requerido' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres un asistente que extrae datos de productores agrícolas a partir de texto hablado en español colombiano.
Debes extraer los siguientes campos del texto y devolver SOLO un JSON válido (sin markdown, sin \`\`\`):

{
  "nombre": "nombre de pila",
  "apellidos": "apellidos",
  "telefono": "número de teléfono (solo dígitos)",
  "numeroDocumento": "cédula o documento (solo dígitos)",
  "direccion": "dirección completa",
  "correo": "email si se menciona",
  "nombreAsociacion": "nombre de la asociación si se menciona",
  "cultivo": "tipo de cultivo si se menciona",
  "hectareas": "número de hectáreas si se menciona (solo número)"
}

Reglas:
- Si un campo no se menciona, déjalo como cadena vacía "".
- Para teléfono y documento, extrae SOLO los dígitos, sin espacios ni guiones.
- Para hectáreas, devuelve solo el número (puede ser decimal con punto).
- El correo debe tener formato válido. Si el usuario dice "arroba" conviértelo a @, "punto" a ".", "gmail punto com" a "gmail.com".
- Si el usuario dice "cédula" o "documento" seguido de números, eso es el numeroDocumento.
- Si dicen nombres propios al inicio, el primer nombre va en "nombre" y el resto en "apellidos".
- Interpreta fonéticamente: "trescientos uno" = "301", "tres cero uno" = "301".
- NO inventes datos que no se mencionan.`
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}';
    
    // Clean potential markdown wrapping
    const cleanJson = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error en process-voice-evento:', error);
    return NextResponse.json(
      { error: 'Error al procesar la transcripción de voz' },
      { status: 500 }
    );
  }
}
