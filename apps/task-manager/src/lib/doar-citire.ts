/**
 * Modul „doar citire" de pe Vercel, din ziua mutării pe Cloudflare.
 *
 * De aici încolo datele adevărate sunt în D1; o scriere făcută în Supabase s-ar
 * pierde, fiindcă nu mai ajunge nicăieri. De aceea copia de pe Vercel lasă
 * doar citirea, iar o bandă spune de ce. Vercel rămâne pornit 30 de zile ca
 * drum înapoi: întoarcerea înseamnă domeniul înapoi aici și o publicare fără
 * acest mod (o versiune de dinainte, din panoul Vercel → Deployments).
 */
export const DOAR_CITIRE = true;

export const MESAJ_DOAR_CITIRE =
  "Aplicația s-a mutat pe Cloudflare. Aici se mai poate doar citi; modificările nu se mai salvează. " +
  "Deschide din nou sarcini.dumitru.cloud și conectează-te cu aceeași parolă.";
