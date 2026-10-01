/*
 * Sorteio em orbe — uma esfera gigante em que cada pontinho é um CUPOM.
 * Quem tem mais cupons tem mais pontinhos, então mais chance (sorteio ponderado).
 *
 * Roteiro do sorteio:
 *   ocioso     → a orbe gira devagar; passando o mouse num ponto mostra de quem é
 *   acelerando → a rotação dispara e os nomes passam correndo no centro
 *   freando    → desacelera e a rotação é calculada pra parar com o cupom
 *                vencedor exatamente de frente, no meio da tela
 *   revelando  → o cupom vencedor cresce e brilha; os demais explodem pra fora
 *   resultado  → nome do ganhador, quantos cupons tinha e a chance
 *
 * O vencedor é sorteado ANTES da animação (um cupom ao acaso) e a animação é
 * calculada pra terminar nele — o que aparece na tela é sempre o resultado real.
 */
(function () {
    'use strict';
    var TAU = Math.PI * 2;
    function limitar(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function saidaQuartica(x) { return 1 - Math.pow(1 - x, 4); }
    function suave(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

    function criar(canvas, op) {
        var ctx = canvas.getContext('2d');
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var W = 0, H = 0, R = 0, cx = 0, cy = 0;

        var participantes = [];   // {nome, cupons}
        var pontos = [];          // um por cupom: {x,y,z, dono}
        var angY = 0, angX = 0.32, velocidade = 0.25;
        var velAtual = 0;         // velocidade real de giro (rad/s), usada pro rastro
        var etapa = 'ocioso', inicioEtapa = 0;
        var vencedor = -1;        // índice do ponto sorteado
        var freioDe = null;       // {a0, a1, x0, x1}
        var particulas = [];
        var mouse = null, nomeSobMouse = null;
        var avisar = op.aoMudar || function () {};

        function medir() {
            var r = canvas.getBoundingClientRect();
            W = r.width; H = r.height;
            canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
            cx = W / 2; cy = H * 0.46;
            R = Math.min(W, H) * 0.34;
        }

        // Esfera de Fibonacci com um ponto por cupom, embaralhados (os cupons de uma
        // mesma pessoa ficam espalhados pela orbe, não agrupados)
        function montar(lista) {
            participantes = lista.map(function (p) { return { nome: p[0], cupons: p[1] }; });
            var donos = [];
            participantes.forEach(function (p, i) { for (var k = 0; k < p.cupons; k++) donos.push(i); });
            for (var i = donos.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = donos[i]; donos[i] = donos[j]; donos[j] = t; }
            var n = donos.length, ouro = Math.PI * (3 - Math.sqrt(5));
            pontos = donos.map(function (dono, k) {
                var y = 1 - (k / Math.max(1, n - 1)) * 2, r = Math.sqrt(1 - y * y), th = ouro * k;
                return { x: Math.cos(th) * r, y: y, z: Math.sin(th) * r, dono: dono, brilho: Math.random() };
            });
            vencedor = -1;
            avisar();
        }

        function girar(p) {
            var ca = Math.cos(angY), sa = Math.sin(angY), ci = Math.cos(angX), si = Math.sin(angX);
            var x1 = p.x * ca + p.z * sa, z1 = -p.x * sa + p.z * ca;
            var y2 = p.y * ci - z1 * si, z2 = p.y * si + z1 * ci;
            var persp = 1 / (1 - z2 * 0.28);
            return { x: cx + x1 * R * persp, y: cy + y2 * R * persp, z: z2, s: persp };
        }

        // Ângulos que deixam um ponto exatamente de frente, no centro
        function angulosPara(p) {
            var a = Math.atan2(-p.x, p.z);
            var z1 = -p.x * Math.sin(a) + p.z * Math.cos(a);
            return { a: a, x: Math.atan2(p.y, z1) };
        }

        function sortear() {
            if (etapa !== 'ocioso' && etapa !== 'resultado') return;
            if (!pontos.length) return;
            // Um cupom ao acaso: cada cupom é um ponto, então a chance já é proporcional
            vencedor = Math.floor(Math.random() * pontos.length);
            mudar('acelerando');
        }

        function mudar(nova) { etapa = nova; inicioEtapa = performance.now(); avisar(); }

        function quemNaFrente() {
            var melhor = -1, menor = 1e9;
            for (var i = 0; i < pontos.length; i++) {
                var q = girar(pontos[i]);
                if (q.z < 0.6) continue;
                var d = (q.x - cx) * (q.x - cx) + (q.y - cy) * (q.y - cy);
                if (d < menor) { menor = d; melhor = i; }
            }
            return melhor >= 0 ? participantes[pontos[melhor].dono].nome : '';
        }

        function avancar(agora, dt) {
            var t = (agora - inicioEtapa) / 1000;
            var angAntes = angY;
            if (etapa === 'ocioso' || etapa === 'resultado') {
                angY += 0.22 * dt;
                angX = 0.32 + Math.sin(agora / 4000) * 0.08;
            } else if (etapa === 'acelerando') {
                velocidade = 0.25 + 9.5 * suave(limitar(t / 2.2));
                angY += velocidade * dt;
                angX = 0.32 + Math.sin(agora / 600) * 0.1 * limitar(t);
                if (t > 2.8) {
                    // Calcula onde parar: o vencedor de frente, com várias voltas antes
                    var alvo = angulosPara(pontos[vencedor]);
                    var voltas = 4 * TAU;
                    var a1 = alvo.a;
                    while (a1 < angY + voltas) a1 += TAU;
                    freioDe = { a0: angY, a1: a1, x0: angX, x1: alvo.x };
                    mudar('freando');
                }
            } else if (etapa === 'freando') {
                var k = saidaQuartica(limitar(t / 4.6));
                angY = freioDe.a0 + (freioDe.a1 - freioDe.a0) * k;
                angX = freioDe.x0 + (freioDe.x1 - freioDe.x0) * suave(limitar(t / 4.6));
                if (t >= 4.6) { angY = freioDe.a1; angX = freioDe.x1; explodir(); mudar('revelando'); }
            } else if (etapa === 'revelando') {
                if (t > 1.9) mudar('resultado');
            }
            if (dt > 0) velAtual = velAtual * 0.6 + ((angY - angAntes) / dt) * 0.4;
            // confete
            for (var i = particulas.length - 1; i >= 0; i--) {
                var p = particulas[i];
                p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= dt;
                if (p.vida <= 0) particulas.splice(i, 1);
            }
        }

        function explodir() {
            for (var i = 0; i < 160; i++) {
                var a = Math.random() * TAU, v = 180 + Math.random() * 520;
                particulas.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 160,
                                  vida: 1.4 + Math.random() * 1.4, tam: 1.5 + Math.random() * 3.2,
                                  cor: Math.random() < 0.7 ? '212,175,55' : (Math.random() < 0.5 ? '255,244,214' : '194,58,46') });
            }
        }

        function desenhar(agora) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            var t = (agora - inicioEtapa) / 1000;
            var abrir = etapa === 'revelando' ? suave(limitar(t / 1.3)) : (etapa === 'resultado' ? 1 : 0);
            var rapido = etapa === 'acelerando' || etapa === 'freando';
            var rastro = rapido ? limitar((Math.abs(velAtual) - 1.5) / 6) : 0;

            // halo atrás da orbe
            var g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.5);
            g.addColorStop(0, 'rgba(212,175,55,' + (0.10 + (rapido ? 0.06 : 0)) + ')');
            g.addColorStop(1, 'rgba(212,175,55,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

            // projeta e desenha de trás pra frente
            var proj = pontos.map(function (p, i) { var q = girar(p); q.i = i; return q; });
            proj.sort(function (a, b) { return a.z - b.z; });
            var base = Math.max(1.4, R / 150);
            nomeSobMouse = null;
            var maisPerto = 1e9;

            for (var k = 0; k < proj.length; k++) {
                var q = proj[k];
                var ehVencedor = q.i === vencedor && (etapa === 'freando' || etapa === 'revelando' || etapa === 'resultado');
                if (ehVencedor) continue;
                var prof = (q.z + 1) / 2;
                var x = q.x, y = q.y, alfa = 0.15 + 0.85 * prof;
                if (abrir > 0) {
                    // os outros cupons explodem pra fora e somem
                    x = cx + (q.x - cx) * (1 + abrir * 2.4);
                    y = cy + (q.y - cy) * (1 + abrir * 2.4);
                    alfa *= (1 - abrir);
                    if (alfa <= 0.01) continue;
                }
                var cintila = 0.75 + 0.25 * Math.sin(agora / 380 + pontos[q.i].brilho * 20);
                var luz = (0.5 + 0.5 * prof) * (rapido ? 1 : cintila);
                var cor = 'rgba(' + Math.round(212 * luz + 40 * prof) + ',' + Math.round(175 * luz + 30 * prof) + ',' + Math.round(55 * luz) + ',' + alfa.toFixed(3) + ')';
                var raioPto = base * (0.55 + 0.75 * prof) * q.s;
                if (rastro > 0.01 && abrir === 0) {
                    // Rastro: onde o ponto estava um instante atrás → onde está agora
                    var salvo = angY; angY -= velAtual * 0.03;
                    var qa = girar(pontos[q.i]); angY = salvo;
                    ctx.strokeStyle = cor; ctx.lineWidth = raioPto * 1.5; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(qa.x, qa.y); ctx.lineTo(x, y); ctx.stroke();
                } else {
                    ctx.fillStyle = cor;
                    ctx.beginPath(); ctx.arc(x, y, raioPto, 0, TAU); ctx.fill();
                }

                if (mouse && etapa === 'ocioso' && q.z > 0) {
                    var d = (mouse.x - x) * (mouse.x - x) + (mouse.y - y) * (mouse.y - y);
                    if (d < 90 && d < maisPerto) { maisPerto = d; nomeSobMouse = { nome: participantes[pontos[q.i].dono].nome, x: x, y: y }; }
                }
            }

            // cupom vencedor: acende enquanto freia, cresce na revelação
            if (vencedor >= 0 && (etapa === 'freando' || etapa === 'revelando' || etapa === 'resultado')) {
                var qv = girar(pontos[vencedor]);
                var aceso = etapa === 'freando' ? limitar((t - 2.6) / 2) : 1;
                var tam = base * 1.6 * qv.s;
                if (etapa !== 'freando') tam += (R * 0.13) * (etapa === 'resultado' ? 1 : suave(limitar(t / 1.1)));
                if (etapa === 'resultado') tam *= 1 + Math.sin(agora / 420) * 0.04;
                var vx = etapa === 'freando' ? qv.x : cx, vy = etapa === 'freando' ? qv.y : cy;
                var gv = ctx.createRadialGradient(vx, vy, 0, vx, vy, tam * 3.2);
                gv.addColorStop(0, 'rgba(255,244,214,' + (0.55 * aceso) + ')');
                gv.addColorStop(1, 'rgba(212,175,55,0)');
                ctx.fillStyle = gv; ctx.beginPath(); ctx.arc(vx, vy, tam * 3.2, 0, TAU); ctx.fill();
                var gc = ctx.createRadialGradient(vx - tam * 0.3, vy - tam * 0.3, tam * 0.1, vx, vy, tam);
                gc.addColorStop(0, '#fff8e1'); gc.addColorStop(0.45, '#f0cf6a'); gc.addColorStop(1, '#a6841e');
                ctx.fillStyle = aceso < 1 ? 'rgba(240,207,106,' + (0.4 + 0.6 * aceso) + ')' : gc;
                ctx.beginPath(); ctx.arc(vx, vy, tam, 0, TAU); ctx.fill();
            }

            // confete
            particulas.forEach(function (p) {
                ctx.fillStyle = 'rgba(' + p.cor + ',' + limitar(p.vida / 1.2).toFixed(3) + ')';
                ctx.fillRect(p.x, p.y, p.tam, p.tam * 1.6);
            });

            // nome sob o mouse (só com a orbe parada)
            if (nomeSobMouse) {
                ctx.font = '600 13px Inter, sans-serif';
                var w = ctx.measureText(nomeSobMouse.nome).width + 18;
                var bx = Math.min(W - w - 8, nomeSobMouse.x + 12), by = nomeSobMouse.y - 34;
                ctx.fillStyle = '#1d1d23'; ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, w, 26, 6) : ctx.rect(bx, by, w, 26); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#f2f2f4'; ctx.fillText(nomeSobMouse.nome, bx + 9, by + 17);
            }
        }

        var ultimo = 0, raf = 0;
        function laco(agora) {
            var dt = ultimo ? Math.min(0.05, (agora - ultimo) / 1000) : 0;
            ultimo = agora;
            avancar(agora, dt);
            desenhar(agora);
            raf = requestAnimationFrame(laco);
        }

        canvas.addEventListener('mousemove', function (e) { var r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
        canvas.addEventListener('mouseleave', function () { mouse = null; });
        window.addEventListener('resize', medir);

        medir();
        montar(op.participantes || []);
        raf = requestAnimationFrame(laco);

        return {
            sortear: sortear,
            etapa: function () { return etapa; },
            nomeNaFrente: quemNaFrente,
            ganhador: function () {
                if (vencedor < 0) return null;
                var p = participantes[pontos[vencedor].dono];
                return { nome: p.nome, cupons: p.cupons, chance: p.cupons / pontos.length };
            },
            totais: function () { return { participantes: participantes.length, cupons: pontos.length }; },
            // Tira o ganhador da orbe pra sortear o próximo lugar sem repetir a pessoa
            tirarGanhador: function () {
                if (vencedor < 0) return;
                var dono = pontos[vencedor].dono;
                var lista = participantes.filter(function (_, i) { return i !== dono; }).map(function (p) { return [p.nome, p.cupons]; });
                // Sai do "resultado" antes de reconstruir: a tela é avisada no meio da
                // reconstrução, e nesse instante já não existe mais ganhador pra mostrar
                etapa = 'ocioso'; inicioEtapa = performance.now();
                montar(lista);
            },
            reiniciar: function () { vencedor = -1; mudar('ocioso'); },
            medir: medir,
            parar: function () { cancelAnimationFrame(raf); }
        };
    }

    window.SorteioOrbe = { criar: criar };
})();
