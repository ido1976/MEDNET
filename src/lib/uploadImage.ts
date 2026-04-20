import { supabase } from './supabase';

/**
 * Generic image uploader for any Supabase Storage bucket.
 * Uses ArrayBuffer — the correct method for React Native (blob doesn't work on RN).
 * Returns the public URL.
 */
export async function uploadImage(localUri: string, bucket: string): Promise<string> {
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const ext = localUri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext === 'png' ? 'png' : 'jpg'}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, arrayBuffer, { contentType, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return data.publicUrl;
}

/**
 * Uploads a local image URI to the apartment-images bucket.
 * @deprecated Use uploadImage(localUri, 'apartment-images') instead.
 */
export async function uploadApartmentImage(localUri: string): Promise<string> {
  return uploadImage(localUri, 'apartment-images');
}
