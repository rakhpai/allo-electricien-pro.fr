import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const { data, error } = await supabase
  .from('source_images')
  .select('image_number, storage_path, storage_bucket')
  .in('image_number', [1, 2, 3, 100, 200, 342])
  .order('image_number');

if (error) {
  console.error('Error:', error);
} else {
  console.log(JSON.stringify(data, null, 2));
}
