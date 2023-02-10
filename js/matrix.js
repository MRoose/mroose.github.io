let q = document.getElementById('q');
q.width = window.screen.width;
q.height = window.screen.height;

let p = Array(256).join(1).split('');
let c = q.getContext('2d');

setInterval(() => {

  c.fillStyle = 'rgba(0,0,0,0.05)';
  c.fillRect(0, 0, q.width, q.height);
  c.fillStyle = 'rgba(0,255,0,1)';

  p = p
    .map((v, i) => {
      r = Math.random();
      c.fillText(String.fromCharCode(Math.floor(2720 + r * 33)), i * 10, v);
      v += 10;
      return v > 768 + r * 1e4 ? 0 : v
    })
}, 33);
