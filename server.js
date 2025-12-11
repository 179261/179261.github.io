import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbs');
const METADATA_FILE = path.join(__dirname, 'images.json');

await fs.mkdir(UPLOAD_DIR, { recursive: true });
await fs.mkdir(THUMB_DIR, { recursive: true });
try { await fs.access(METADATA_FILE); } catch { await fs.writeFile(METADATA_FILE, '[]'); }

const app = express();
app.use(helmet());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

// 简单速率限制
const limiter = rateLimit({ windowMs: 60_000, max: 60 });
app.use(limiter);

// multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('只允许图片类型'));
    } else cb(null, true);
  }
});

app.post('/upload', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || !req.files.length) return res.status(400).send('没有文件');

    const metadata = JSON.parse(await fs.readFile(METADATA_FILE, 'utf8'));
    for (const f of req.files) {
      // 校验真实文件类型
      const ft = await fileTypeFromBuffer(f.buffer);
      if (!ft || !ft.mime.startsWith('image/')) {
        // 跳过或返回错误：这里直接跳过
        continue;
      }

      // 生成随机文件名，保留扩展名
      const ext = mime.extension(ft.mime) || 'jpg';
      const id = uuidv4();
      const filename = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      // 使用 sharp 进行缩放（例如最大宽高 2000px）并保存
      const image = sharp(f.buffer);
      const metadataInfo = await image.metadata();
      const maxDim = 2000;
      if (metadataInfo.width && metadataInfo.width > maxDim || metadataInfo.height && metadataInfo.height > maxDim) {
        await image.resize({ width: maxDim, height: maxDim, fit: 'inside' }).toFile(filepath);
      } else {
        // 直接写入原始 buffer（保持格式）
        await fs.writeFile(filepath, f.buffer);
      }

      // 生成缩略图
      const thumbName = `thumb-${filename}`;
      const thumbPath = path.join(THUMB_DIR, thumbName);
      await sharp(f.buffer).resize(300, 300, { fit: 'cover' }).toFile(thumbPath);

      // 记录元数据
      metadata.unshift({
        id,
        filename,
        thumb: thumbName,
        originalName: f.originalname,
        mime: ft.mime,
        size: f.size,
        width: metadataInfo.width || null,
        height: metadataInfo.height || null,
        createdAt: new Date().toISOString()
      });
    }

    await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('服务器错误');
  }
});

// 返回图片列表（注意：生产应分页）
app.get('/images', async (req, res) => {
  try {
    const data = JSON.parse(await fs.readFile(METADATA_FILE, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).send('读取失败');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server started on http://localhost:${port}`));