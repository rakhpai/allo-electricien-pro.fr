import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';

// Initialize Hono app
const app = new Hono();

// CORS configuration - allow all origins for API access
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 3600,
}));

// Initialize Supabase client
function getSupabaseClient(env) {
  return createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// Root endpoint - API information
app.get('/', (c) => {
  return c.json({
    name: 'allo-electricien.pro API',
    version: c.env?.API_VERSION || '1.0.0',
    status: 'operational',
    endpoints: {
      professionals: '/api/professionals',
      cities: '/api/cities',
      videos: '/api/videos',
      content: '/api/content'
    },
    documentation: 'https://allo-electricien.pro/api/docs'
  });
});

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env?.ENVIRONMENT || 'development'
  });
});

// ============================================
// PROFESSIONALS ENDPOINTS
// ============================================

// GET /api/professionals - List all professionals with optional filters
app.get('/api/professionals', async (c) => {
  const supabase = getSupabaseClient(c.env);

  // Query parameters for filtering
  const city = c.req.query('city');
  const department = c.req.query('department');
  const serviceType = c.req.query('service_type');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const search = c.req.query('search');

  try {
    // Start building query
    let query = supabase
      .from('electricien_profiles')
      .select('*', { count: 'exact' });

    // Apply filters
    if (city) {
      query = query.eq('city', city);
    }

    if (department) {
      query = query.eq('department', department);
    }

    if (serviceType) {
      query = query.contains('services', [serviceType]);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({
      data,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });
  } catch (err) {
    console.error('Error fetching professionals:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/professionals/:id - Get single professional by ID
app.get('/api/professionals/:id', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const id = c.req.param('id');

  try {
    const { data, error } = await supabase
      .from('electricien_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Professional not found' }, 404);
      }
      console.error('Supabase error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ data });
  } catch (err) {
    console.error('Error fetching professional:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/professionals/city/:citySlug - Get professionals by city slug
app.get('/api/professionals/city/:citySlug', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const citySlug = c.req.param('citySlug');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    // First, get city info
    const { data: cityData, error: cityError } = await supabase
      .from('geographic_locations')
      .select('*')
      .eq('slug', citySlug)
      .single();

    if (cityError || !cityData) {
      return c.json({ error: 'City not found' }, 404);
    }

    // Then get professionals for that city
    const { data, error, count } = await supabase
      .from('electricien_profiles')
      .select('*', { count: 'exact' })
      .eq('city_slug', citySlug)
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({
      city: cityData,
      professionals: data,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });
  } catch (err) {
    console.error('Error fetching professionals by city:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================
// CITIES ENDPOINTS
// ============================================

// GET /api/cities - List all cities with optional filters
app.get('/api/cities', async (c) => {
  const supabase = getSupabaseClient(c.env);

  const department = c.req.query('department');
  const region = c.req.query('region');
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');
  const search = c.req.query('search');

  try {
    let query = supabase
      .from('geographic_locations')
      .select('*', { count: 'exact' });

    if (department) {
      query = query.eq('department_code', department);
    }

    if (region) {
      query = query.eq('type', region);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    query = query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({
      data,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });
  } catch (err) {
    console.error('Error fetching cities:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/cities/:slug - Get single city by slug
app.get('/api/cities/:slug', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const slug = c.req.param('slug');

  try {
    const { data, error } = await supabase
      .from('geographic_locations')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'City not found' }, 404);
      }
      console.error('Supabase error:', error);
      return c.json({ error: error.message }, 500);
    }

    // Also get count of professionals in this city
    const { count: profCount } = await supabase
      .from('electricien_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('city_slug', slug);

    return c.json({
      data: {
        ...data,
        professionals_count: profCount || 0
      }
    });
  } catch (err) {
    console.error('Error fetching city:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/cities/department/:code - Get cities by department code
app.get('/api/cities/department/:code', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const code = c.req.param('code');
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const { data, error, count } = await supabase
      .from('geographic_locations')
      .select('*', { count: 'exact' })
      .eq('department_code', code)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({
      data,
      department: code,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });
  } catch (err) {
    console.error('Error fetching cities by department:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================
// VIDEOS ENDPOINTS
// ============================================

// GET /api/videos - List all videos with optional filters
app.get('/api/videos', async (c) => {
  const supabase = getSupabaseClient(c.env);

  const city = c.req.query('city');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    let query = supabase
      .from('commune_videos')
      .select('*', { count: 'exact' });

    if (city) {
      query = query.eq('commune_slug', city);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({
      data,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });
  } catch (err) {
    console.error('Error fetching videos:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/videos/:slug - Get video by city slug
app.get('/api/videos/:slug', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const slug = c.req.param('slug');

  try {
    const { data, error } = await supabase
      .from('commune_videos')
      .select('*')
      .eq('commune_slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Video not found' }, 404);
      }
      console.error('Supabase error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ data });
  } catch (err) {
    console.error('Error fetching video:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================
// CONTENT / PAGES ENDPOINTS
// ============================================

// GET /api/content - List available content pages
app.get('/api/content', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const { data, error, count } = await supabase
      .from('websites')
      .select('id, subdomain, full_domain, company_name_primary, city, hero_headline, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({
      data,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });
  } catch (err) {
    console.error('Error fetching content pages:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================
// STATISTICS ENDPOINTS
// ============================================

// GET /api/stats - Get overall statistics
app.get('/api/stats', async (c) => {
  const supabase = getSupabaseClient(c.env);

  try {
    // Get counts from different tables
    const [profCount, citiesCount, videosCount] = await Promise.all([
      supabase.from('electricien_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('geographic_locations').select('*', { count: 'exact', head: true }),
      supabase.from('commune_videos').select('*', { count: 'exact', head: true })
    ]);

    return c.json({
      data: {
        professionals: profCount.count || 0,
        cities: citiesCount.count || 0,
        videos: videosCount.count || 0,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error fetching statistics:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: c.req.path
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message
  }, 500);
});

// Export for Cloudflare Workers
export default app;
