import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load .env manually
const env = fs.readFileSync('d:/smart-mine/.env', 'utf8');
function get(k) {
  const m = env.split(/\r?\n/).find((l) => l.startsWith(k + '='));
  return m ? m.slice(k.length + 1).trim() : '';
}
const url = get('VITE_SUPABASE_URL');
const secret = get('SUPABASE_SECRET_KEY');

// Credentials come from .env — never hardcode real accounts: this repo is public
const email = get('VITE_TEST_EMAIL');
const password = get('VITE_TEST_PASSWORD');
if (!email || !password) {
  console.log('Set VITE_TEST_EMAIL and VITE_TEST_PASSWORD in .env (this repo is public, do not hardcode credentials).');
  process.exit(1);
}

// Use the secret key as the service-role / admin key
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${secret}`, apikey: secret } },
});

async function main() {
  console.log('URL =', url);
  try {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      console.log('LIST ERROR:', error.message);
      return;
    }
    const users = data.users;
    const found = users.filter((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (!found.length) {
      console.log('User does NOT exist. (unexpected)');
      return;
    }
    const u = found[0];
    console.log('AUTH USER id=', u.id, 'confirmed=', u.email_confirmed_at);

    // 1) Check the profiles table for this auth user
    const { data: profs, error: perr } = await admin
      .from('profiles')
      .select('id, employee_id, full_name, email, role, is_active')
      .eq('auth_user_id', u.id);
    if (perr) {
      console.log('PROFILE QUERY ERROR:', perr.message);
    } else {
      if (profs && profs.length) {
        console.log('PROFILE ROW(S):', JSON.stringify(profs));
      } else {
        console.log('PROFILE ROW: NONE — needsRoleSelection will be true for this user.');
      }
    }

    // 2) Test whether the supplied password is correct via a real sign-in
    const anon = createClient(url, get('VITE_SUPABASE_PUBLISHABLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) {
      console.log('PASSWORD CHECK FAILED:', signInErr.message);
      console.log('Resetting password to ' + password + '...');
      const { error: rerr } = await admin.auth.admin.updateUserById(u.id, { password });
      if (rerr) {
        console.log('RESET ERROR:', rerr.message);
      } else {
        console.log('PASSWORD RESET OK to ' + password);
        // Re-test after reset
        const { error: e2 } = await anon.auth.signInWithPassword({ email, password });
        console.log('RETEST after reset:', e2 ? 'FAIL: ' + e2.message : 'SUCCESS');
      }
    } else {
      console.log('PASSWORD CHECK: SUCCESS (' + password + ' works)');
    }
  } catch (e) {
    console.log('FATAL:', e.message);
  }
}
main();

