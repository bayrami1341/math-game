'use strict';

function productionConfig(env) {
  if (env.FIREBASE_AUTH_EMULATOR_HOST || env.FIREBASE_DATABASE_EMULATOR_HOST) throw new Error('Production entry point refuses emulator environment variables');
  if (!env.MATH_GAME_ID_SECRET || env.MATH_GAME_ID_SECRET.length < 32) throw new Error('MATH_GAME_ID_SECRET (32+ characters) is required');
  if (!env.FIREBASE_PROJECT_ID || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(env.FIREBASE_PROJECT_ID)) throw new Error('FIREBASE_PROJECT_ID is required');
  let database;
  try { database = new URL(env.FIREBASE_DATABASE_URL); } catch { throw new Error('Valid FIREBASE_DATABASE_URL is required'); }
  const project = env.FIREBASE_PROJECT_ID;
  const databaseHost = new RegExp('^' + project + '(?:-default-rtdb)?(?:\\.[a-z0-9-]+)?\\.(?:firebasedatabase\\.app|firebaseio\\.com)$');
  if (database.protocol !== 'https:' || !databaseHost.test(database.hostname) || database.username || database.password || database.port || database.search || database.hash || database.pathname !== '/') throw new Error('Database URL must belong to FIREBASE_PROJECT_ID and use HTTPS');
  const origins = (env.MATH_GAME_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { throw new Error('Invalid allowed origin'); }
    if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('Allowed origins must be HTTPS origins without a path');
  }
  return { projectId: project, databaseURL: database.origin, allowedOrigins: origins,
    teacherUids: new Set((env.MATH_GAME_TEACHER_UIDS || '').split(',').map(value => value.trim()).filter(Boolean)),
    teacherEmails: new Set((env.MATH_GAME_TEACHER_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)) };
}
function isTeacher(claims, config) {
  return claims.teacher === true || config.teacherUids.has(claims.uid) ||
    (claims.email_verified === true && typeof claims.email === 'string' && config.teacherEmails.has(claims.email.toLowerCase()));
}
module.exports = { productionConfig, isTeacher };
