// 简单的前端上传与进度演示
(() => {
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const preview = document.getElementById('preview');
  const uploadBtn = document.getElementById('uploadBtn');
  const progressWrap = document.getElementById('progressWrap');
  const gallery = document.getElementById('gallery');

  let files = [];

  function renderPreview() {
    preview.innerHTML = '';
    files.forEach((f, idx) => {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = URL.createObjectURL(f);
      img.title = f.name;
      preview.appendChild(img);
    });
  }

  fileInput.addEventListener('change', e => {
    files = Array.from(e.target.files);
    renderPreview();
  });

  // drag & drop
  ['dragenter','dragover'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault(); e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });
  ['dragleave','drop'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault(); e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });
  dropzone.addEventListener('drop', e => {
    files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    renderPreview();
  });
  dropzone.addEventListener('click', () => fileInput.click());

  uploadBtn.addEventListener('click', () => {
    if (!files.length) return alert('请选择图片');
    uploadFiles(files);
  });

  function uploadFiles(fileList) {
    progressWrap.innerHTML = '';
    uploadBtn.disabled = true;
    const form = new FormData();
    fileList.forEach(f => form.append('images', f));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);
    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      const percent = Math.round((e.loaded / e.total) * 100);
      progressWrap.textContent = `上传进度：${percent}%`;
    };
    xhr.onload = () => {
      uploadBtn.disabled = false;
      progressWrap.textContent = '';
      if (xhr.status === 200) {
        files = [];
        preview.innerHTML = '';
        fetchGallery();
      } else {
        alert('上传失败：' + xhr.responseText);
      }
    };
    xhr.onerror = () => {
      uploadBtn.disabled = false;
      alert('网络错误');
    };
    xhr.send(form);
  }

  async function fetchGallery() {
    const res = await fetch('/images');
    if (!res.ok) return;
    const list = await res.json();
    gallery.innerHTML = '';
    list.forEach(it => {
      const a = document.createElement('a');
      a.href = `/uploads/${it.filename}`;
      a.target = '_blank';
      const img = document.createElement('img');
      img.src = `/uploads/thumbs/${it.thumb}`;
      img.alt = it.originalName || '';
      a.appendChild(img);
      gallery.appendChild(a);
    });
  }

  // 初次加载
  fetchGallery();
})();