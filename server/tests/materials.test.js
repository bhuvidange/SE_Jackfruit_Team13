const fs = require('fs');
const request = require('supertest');
const { app, connect, disconnect, clearAll, createUser, bearer } = require('./helpers');
const Material = require('../src/models/Material');
const config = require('../src/config');

beforeAll(connect);
afterAll(async () => {
  await disconnect();
  fs.rmSync(config.uploadDir, { recursive: true, force: true });
});
afterEach(clearAll);

const MB = 1024 * 1024;
const MAX = 15 * MB;
const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
};
const HEAD = {
  pdf: Buffer.from('%PDF-1.4\n'),
  docx: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  pptx: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
};

/** Builds a buffer of exactly `size` bytes starting with the right magic bytes. */
function fileOf(ext, size = 2048) {
  const buf = Buffer.alloc(size, 0x61);
  HEAD[ext].copy(buf);
  return buf;
}

function upload(token, { ext = 'pdf', name, size, contentType, meta = {}, buffer } = {}) {
  const req = request(app).post('/api/materials').set(bearer(token));
  const fields = { title: 'Lecture 1', subject: 'Networks', topic: 'TCP', ...meta };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) req.field(k, v);
  return req.attach('file', buffer || fileOf(ext, size), { filename: name || `notes.${ext}`, contentType: contentType || MIME[ext] });
}

describe('TC-Mat-01 instructor uploads PDF/DOCX/PPTX/JPG (CSMQP-F-010)', () => {
  test.each(['pdf', 'docx', 'pptx', 'jpg'])('%s is accepted', async (ext) => {
    const { token } = await createUser('instructor');
    const res = await upload(token, { ext });
    expect(res.status).toBe(201);
    expect(res.body.material).toMatchObject({ format: ext, originalName: `notes.${ext}`, size: 2048 });
    expect(res.body.material.storedName).toBeUndefined();
  });

  test('.jpeg extension is stored as jpg', async () => {
    const { token } = await createUser('instructor');
    const res = await upload(token, { ext: 'jpg', name: 'photo.JPEG' });
    expect(res.status).toBe(201);
    expect(res.body.material.format).toBe('jpg');
  });

  test.each([
    ['exe', 'application/octet-stream'],
    ['txt', 'text/plain'],
    ['gif', 'image/gif'],
    ['doc', 'application/msword'],
  ])('.%s is rejected with 400', async (ext, contentType) => {
    const { token } = await createUser('instructor');
    const res = await upload(token, { buffer: Buffer.from('plain'), name: `file.${ext}`, contentType });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unsupported file type/);
    expect(await Material.countDocuments()).toBe(0);
  });

  test('wrong mime type for a supported extension is rejected', async () => {
    const { token } = await createUser('instructor');
    expect((await upload(token, { ext: 'pdf', contentType: 'text/html' })).status).toBe(400);
  });

  test('file whose content does not match its extension is rejected and removed from disk', async () => {
    const { token } = await createUser('instructor');
    const before = fs.existsSync(config.uploadDir) ? fs.readdirSync(config.uploadDir).length : 0;
    const res = await upload(token, { buffer: Buffer.from('<html>not a pdf</html>'), name: 'fake.pdf', contentType: MIME.pdf });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not match/);
    expect(fs.readdirSync(config.uploadDir).length).toBe(before);
  });

  test('missing file or missing metadata is rejected', async () => {
    const { token } = await createUser('instructor');
    const noFile = await request(app).post('/api/materials').set(bearer(token)).field('title', 'x').field('subject', 's').field('topic', 't');
    expect(noFile.status).toBe(400);
    const noTitle = await upload(token, { meta: { title: undefined } });
    expect(noTitle.status).toBe(400);
  });

  test('student cannot upload (403) and anonymous gets 401', async () => {
    const student = await createUser('student');
    expect((await upload(student.token)).status).toBe(403);
    const anon = await request(app).post('/api/materials').attach('file', fileOf('pdf'), { filename: 'a.pdf', contentType: MIME.pdf });
    expect(anon.status).toBe(401);
    expect(await Material.countDocuments()).toBe(0);
  });
});

describe('TC-Mat-02 file size limit of 15 MB (CSMQP-F-011)', () => {
  test('a file of exactly 15 MB is accepted', async () => {
    const { token } = await createUser('instructor');
    const res = await upload(token, { ext: 'pdf', size: MAX });
    expect(res.status).toBe(201);
    expect(res.body.material.size).toBe(MAX);
  });

  test('a file of 15 MB + 1 byte is rejected and not stored', async () => {
    const { token } = await createUser('instructor');
    const before = fs.existsSync(config.uploadDir) ? fs.readdirSync(config.uploadDir).length : 0;
    const res = await upload(token, { ext: 'pdf', size: MAX + 1 });
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/15 MB/);
    expect(await Material.countDocuments()).toBe(0);
    expect(fs.readdirSync(config.uploadDir).length).toBe(before);
  });

  test('a file well over the limit is rejected', async () => {
    const { token } = await createUser('instructor');
    expect((await upload(token, { ext: 'jpg', size: MAX + MB })).status).toBe(413);
  });

  test('an empty-looking tiny file (just the header) is accepted', async () => {
    const { token } = await createUser('instructor');
    expect((await upload(token, { ext: 'pdf', size: 4 })).status).toBe(201);
  });
});

describe('TC-Mat-03 categorise by subject/topic (CSMQP-F-012)', () => {
  test('metadata is stored and returned in list and detail', async () => {
    const { token } = await createUser('instructor');
    const created = await upload(token, { meta: { subject: 'Databases', topic: 'Indexing', description: 'B-trees' } });
    expect(created.body.material).toMatchObject({ subject: 'Databases', topic: 'Indexing', description: 'B-trees', title: 'Lecture 1' });

    const stored = await Material.findById(created.body.material.id);
    expect(stored).toMatchObject({ subject: 'Databases', topic: 'Indexing' });

    const detail = await request(app).get(`/api/materials/${created.body.material.id}`).set(bearer(token));
    expect(detail.body.material.topic).toBe('Indexing');
    const list = await request(app).get('/api/materials?subject=databases&topic=INDEXING').set(bearer(token));
    expect(list.body.materials).toHaveLength(1);
  });
});

describe('TC-Mat-04 student searches by name/keyword and downloads (CSMQP-F-013)', () => {
  test('search returns matches and the download is byte-identical', async () => {
    const instructor = await createUser('instructor');
    const student = await createUser('student');
    const content = fileOf('pdf', 5000);
    const a = await upload(instructor.token, { buffer: content, name: 'tcp-handshake.pdf', contentType: MIME.pdf, meta: { title: 'TCP handshake', topic: 'Transport' } });
    await upload(instructor.token, { ext: 'pptx', meta: { title: 'Sorting algorithms', subject: 'Algorithms', topic: 'Sorting' } });

    const byTitle = await request(app).get('/api/materials?query=handshake').set(bearer(student.token));
    expect(byTitle.status).toBe(200);
    expect(byTitle.body.materials.map((m) => m.id)).toEqual([a.body.material.id]);
    expect((await request(app).get('/api/materials?query=SORTING').set(bearer(student.token))).body.materials).toHaveLength(1);
    expect((await request(app).get('/api/materials?query=algorithms').set(bearer(student.token))).body.materials).toHaveLength(1); // matches subject
    expect((await request(app).get('/api/materials').set(bearer(student.token))).body.materials).toHaveLength(2);
    expect((await request(app).get('/api/materials?query=nothing-here').set(bearer(student.token))).body.materials).toHaveLength(0);

    const dl = await request(app)
      .get(`/api/materials/${a.body.material.id}/download`)
      .set(bearer(student.token))
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toContain('tcp-handshake.pdf');
    expect(dl.body.equals(content)).toBe(true);
  });

  test('regex characters in the search are literal', async () => {
    const { token } = await createUser('instructor');
    await upload(token);
    expect((await request(app).get('/api/materials?query=.*').set(bearer(token))).body.materials).toHaveLength(0);
  });

  test('search injection with operator objects is rejected', async () => {
    const { token } = await createUser('student');
    const res = await request(app).get('/api/materials?query[$ne]=x').set(bearer(token));
    expect(res.status).toBe(200); // operator key is stripped by the sanitiser
    expect(res.body.materials).toEqual([]);
  });

  test('download and search need authentication; unknown id is 404', async () => {
    const instructor = await createUser('instructor');
    const { body } = await upload(instructor.token);
    expect((await request(app).get('/api/materials')).status).toBe(401);
    expect((await request(app).get(`/api/materials/${body.material.id}/download`)).status).toBe(401);
    expect((await request(app).get('/api/materials/64b000000000000000000001/download').set(bearer(instructor.token))).status).toBe(404);
    expect((await request(app).get('/api/materials/xyz/download').set(bearer(instructor.token))).status).toBe(400);
  });

  test('removed materials are hidden from search and download', async () => {
    const { token } = await createUser('instructor');
    const { body } = await upload(token);
    await Material.updateOne({ _id: body.material.id }, { status: 'removed' });
    expect((await request(app).get('/api/materials').set(bearer(token))).body.materials).toHaveLength(0);
    expect((await request(app).get(`/api/materials/${body.material.id}/download`).set(bearer(token))).status).toBe(404);
  });
});

describe('DELETE /api/materials/:id (owner or admin only)', () => {
  const del = (token, id) => request(app).delete(`/api/materials/${id}`).set(bearer(token));

  test('the owner can delete; the material then disappears from search', async () => {
    const { token } = await createUser('instructor');
    const { body } = await upload(token);
    expect((await del(token, body.material.id)).status).toBe(200);
    expect((await request(app).get('/api/materials').set(bearer(token))).body.materials).toHaveLength(0);
  });

  test('an admin can delete any material', async () => {
    const owner = await createUser('instructor');
    const admin = await createUser('admin');
    const { body } = await upload(owner.token);
    expect((await del(admin.token, body.material.id)).status).toBe(200);
  });

  test('another instructor and a student get 403 and the material stays', async () => {
    const owner = await createUser('instructor');
    const other = await createUser('instructor');
    const student = await createUser('student');
    const { body } = await upload(owner.token);
    expect((await del(other.token, body.material.id)).status).toBe(403);
    expect((await del(student.token, body.material.id)).status).toBe(403);
    expect((await request(app).get('/api/materials').set(bearer(owner.token))).body.materials).toHaveLength(1);
  });

  test('needs authentication; unknown id is 404', async () => {
    const { token } = await createUser('instructor');
    expect((await request(app).delete('/api/materials/64b000000000000000000001')).status).toBe(401);
    expect((await del(token, '64b000000000000000000001')).status).toBe(404);
  });
});
