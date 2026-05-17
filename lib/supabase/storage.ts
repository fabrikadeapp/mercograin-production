/**
 * @deprecated Migrado para Railway Volume. Mantido como re-export para
 * compatibilidade com callers existentes. Novos arquivos devem importar
 * direto de '@/lib/storage/local'.
 */

export {
  uploadImage,
  uploadFile,
  deleteImage,
  deleteFile,
  getSignedUrl,
  listFiles,
  getExtensionForMime,
  isSupabaseUrl,
  isLocalStorageUrl,
  readFile,
  verifySignedUrl,
} from '@/lib/storage/local'

export type { UploadResult } from '@/lib/storage/local'
