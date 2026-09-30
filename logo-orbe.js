/*
 * Logo em orbe — os pontinhos giram como uma esfera 3D e, de tempos em tempos, voam
 * pro lugar e formam a logo da loja; depois se soltam e voltam a girar.
 * Canvas puro, sem biblioteca. Pausa com a aba escondida e respeita o "Modo leve"
 * e a preferência do sistema por menos movimento (aí mostra só a logo parada).
 *
 * Uso: LogoOrbe.criar(canvas, { src: 'logo.png', tamanho: 90, pontos: 520 })
 */
(function () {
    'use strict';

    function embaralhar(v) {
        for (var i = v.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = v[i]; v[i] = v[j]; v[j] = t; }
        return v;
    }
    function suave(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
    function limitar(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function aleatorio(a, b) { return a + Math.random() * (b - a); }

    // Lê a logo, acha os pixels do traço (onde a imagem não é transparente) e sorteia N
    // pontos entre eles. Coordenadas normalizadas em [-1, 1], centradas.
    function pontosDaLogo(img, n) {
        var R = 240;
        var c = document.createElement('canvas'); c.width = R; c.height = R;
        var x = c.getContext('2d');
        x.drawImage(img, 0, 0, R, R);
        var dados = x.getImageData(0, 0, R, R).data;
        var candidatos = [];
        for (var py = 0; py < R; py += 2) {
            for (var px = 0; px < R; px += 2) {
                if (dados[(py * R + px) * 4 + 3] > 140) candidatos.push([px / R * 2 - 1, py / R * 2 - 1]);
            }
        }
        embaralhar(candidatos);
        var out = [];
        for (var i = 0; i < n; i++) out.push(candidatos[i % Math.max(1, candidatos.length)] || [0, 0]);
        return out;
    }

    // Esfera de Fibonacci: espalha N pontos por igual na superfície
    function pontosDaEsfera(n) {
        var out = [], ouro = Math.PI * (3 - Math.sqrt(5));
        for (var i = 0; i < n; i++) {
            var y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = ouro * i;
            out.push([Math.cos(th) * r, y, Math.sin(th) * r]);
        }
        return out;
    }

    function criar(canvas, op) {
        op = op || {};
        var tamanho = op.tamanho || 90;
        var N = op.pontos || 520;
        var ouro = op.cor || [212, 175, 55];
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(tamanho * dpr);
        canvas.height = Math.round(tamanho * dpr);
        canvas.style.width = tamanho + 'px';
        canvas.style.height = tamanho + 'px';
        var ctx = canvas.getContext('2d');

        var img = new Image();
        var esfera = pontosDaEsfera(N);
        var logo = null;
        // Cada pontinho sai num momento um pouco diferente: a logo se monta em onda
        var atraso = esfera.map(function () { return Math.random() * 0.4; });
        // Depois de formada a logo não congela: cada ponto oscila de leve no seu lugar,
        // com ritmo próprio, e o brilho cintila — fica "viva" sem desmanchar o desenho
        var fase = esfera.map(function () { return Math.random() * Math.PI * 2; });
        var ritmo = esfera.map(function () { return 0.7 + Math.random() * 1.1; });

        var etapa = 'girando', inicioFase = 0, duracaoFase = aleatorio(4, 8);
        var progresso = 0;       // 0 = esfera, 1 = logo
        var mouseEmCima = false;
        var raf = 0, rodando = false;

        function parado() {
            return (document.body && document.body.classList.contains('modo-leve')) ||
                   (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        }

        function trocarFase(nova, agora) {
            etapa = nova; inicioFase = agora;
            duracaoFase = nova === 'girando' ? aleatorio(4, 9)
                        : nova === 'logo' ? aleatorio(2.5, 4.5)
                        : nova === 'alinhando' ? 1.5 : 1.3;
        }

        function avancar(agora) {
            var t = (agora - inicioFase) / 1000;
            if (mouseEmCima) {
                // Com o mouse em cima a logo se forma e fica
                if (etapa === 'girando' || etapa === 'soltando') trocarFase('alinhando', agora - progresso * 1500);
                if (etapa === 'logo') inicioFase = agora;
            }
            if (etapa === 'girando') { progresso = 0; if (t > duracaoFase) trocarFase('alinhando', agora); }
            else if (etapa === 'alinhando') { progresso = limitar(t / duracaoFase); if (progresso >= 1) trocarFase('logo', agora); }
            else if (etapa === 'logo') { progresso = 1; if (t > duracaoFase && !mouseEmCima) trocarFase('soltando', agora); }
            else if (etapa === 'soltando') { progresso = 1 - limitar(t / duracaoFase); if (progresso <= 0) trocarFase('girando', agora); }
        }

        function desenhar(agora) {
            var s = tamanho / 2;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, tamanho, tamanho);

            var ang = agora / 1000 * 0.55;           // giro em torno do eixo vertical
            var inc = 0.38 + Math.sin(agora / 3100) * 0.12;   // inclinação que balança devagar
            var ca = Math.cos(ang), sa = Math.sin(ang), ci = Math.cos(inc), si = Math.sin(inc);
            var raioEsfera = 0.84, pontoBase = Math.max(0.6, tamanho / 150);

            for (var i = 0; i < N; i++) {
                var p = esfera[i];
                var x1 = p[0] * ca + p[2] * sa, z1 = -p[0] * sa + p[2] * ca;
                var y2 = p[1] * ci - z1 * si, z2 = p[1] * si + z1 * ci;
                var ex = x1 * raioEsfera, ey = y2 * raioEsfera;
                var prof = (z2 + 1) / 2;             // 0 atrás, 1 na frente

                var q = suave(limitar((progresso - atraso[i]) / 0.6));
                var lx = logo ? logo[i][0] : ex, ly = logo ? logo[i][1] : ey;
                // Oscilação suave no lugar (só aparece conforme o ponto chega na logo)
                var tt = agora / 1000 * ritmo[i] + fase[i];
                lx += Math.sin(tt) * 0.016;
                ly += Math.cos(tt * 0.87 + 1.3) * 0.016;
                var x = ex + (lx - ex) * q, y = ey + (ly - ey) * q;

                var alfa = (0.18 + 0.82 * prof) * (1 - q) + 1 * q;
                var raio = pontoBase * ((0.55 + 0.75 * prof) * (1 - q) + 0.95 * q);
                // Na esfera, os pontos de trás ficam mais escuros (profundidade)
                var cintila = 0.82 + 0.18 * Math.sin(agora / 1000 * 2.2 + fase[i] * 3);
                var brilho = (0.55 + 0.45 * prof) * (1 - q) + cintila * q;
                ctx.fillStyle = 'rgba(' + Math.round(ouro[0] * brilho) + ',' + Math.round(ouro[1] * brilho) + ',' + Math.round(ouro[2] * brilho) + ',' + alfa.toFixed(3) + ')';
                ctx.beginPath();
                ctx.arc(s + x * s, s + y * s, raio, 0, 6.2832);
                ctx.fill();
            }
        }

        function laco(agora) {
            if (!rodando) return;
            if (parado()) { mostrarParado(); rodando = false; return; }
            avancar(agora); desenhar(agora);
            raf = requestAnimationFrame(laco);
        }
        function iniciar() {
            if (rodando || !logo) return;
            if (parado()) { mostrarParado(); return; }
            rodando = true; inicioFase = performance.now(); raf = requestAnimationFrame(laco);
        }
        function parar() { rodando = false; cancelAnimationFrame(raf); }
        // Modo leve: logo parada, sem animação nenhuma
        function mostrarParado() {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, tamanho, tamanho);
            ctx.drawImage(img, 0, 0, tamanho, tamanho);
        }

        canvas.addEventListener('mouseenter', function () { mouseEmCima = true; });
        canvas.addEventListener('mouseleave', function () { mouseEmCima = false; });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') parar(); else iniciar();
        });

        img.onload = function () { logo = pontosDaLogo(img, N); iniciar(); };
        img.src = op.src;

        return {
            iniciar: iniciar, parar: parar,
            reiniciar: function () { parar(); iniciar(); },
            forcarFase: function (f) { trocarFase(f, performance.now()); },
            // Desenha um quadro específico (usado pra gerar prévias/testes)
            desenharEm: function (p, agora) { progresso = p; desenhar(agora); }
        };
    }

    window.LogoOrbe = { criar: criar };
})();
