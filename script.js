const appState = {
    currentLevel: 1,
    maxLevels: 4,
    content: null,
    weights: { w1: 0.1, w2: 0.1, w3: 0.1 },
    bias: 0,
    learningRate: 0.01,
    currentLoss: 10,
    audioCtx: new (window.AudioContext || window.webkitAudioContext)()
};

const dom = {
    gameArea: document.getElementById('game-area'),
    levelContent: document.getElementById('level-content'),
    nextBtn: document.getElementById('next-level-btn'),
    progressBar: document.getElementById('progress-fill'),
    levelText: document.getElementById('current-level-text'),
    logContent: document.getElementById('log-content'),
    brainCanvas: document.getElementById('brain-canvas'),
    brainOutput: document.getElementById('brain-output'),
    codeBlock: document.getElementById('code-block'),
    codeDrawer: document.getElementById('code-drawer'),
    toggleCode: document.getElementById('toggle-code')
};

/* --- AUDIO ENGINE --- */
function playSound(type) {
    if (appState.audioCtx.state === 'suspended') appState.audioCtx.resume();
    const osc = appState.audioCtx.createOscillator();
    const gain = appState.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(appState.audioCtx.destination);

    if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, appState.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, appState.audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, appState.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, appState.audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(appState.audioCtx.currentTime + 0.5);
    } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, appState.audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, appState.audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, appState.audioCtx.currentTime);
        osc.start();
        osc.stop(appState.audioCtx.currentTime + 0.3);
    }
}

/* --- LOGGING SYSTEM --- */
function log(msg, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString().split(' ')[0];
    entry.textContent = `[${time}] ${msg}`;
    dom.logContent.appendChild(entry);
    dom.logContent.scrollTop = dom.logContent.scrollHeight;
}

/* --- BRAIN VISUALIZER --- */
class BrainVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.neuronState = { active: false, output: 0 };
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Settings
        const cx = this.width / 2;
        const cy = this.height / 2;
        const r = 50; // Larger neuron

        // 1. Inputs (Left lines)
        this.ctx.lineWidth = 3;
        const inputY = [cy - 50, cy, cy + 50];

        inputY.forEach(y => {
            this.ctx.beginPath();
            this.ctx.moveTo(20, y);
            this.ctx.lineTo(cx - r, cy);
            this.ctx.strokeStyle = '#00f7ff';
            this.ctx.stroke();
        });

        // Labels
        this.ctx.fillStyle = '#bbb';
        this.ctx.font = '12px Outfit';
        this.ctx.fillText("Inputs", 10, cy - 70);

        // 2. Neuron Body (Processing)
        const intensity = this.neuronState.output; // 0 to 1

        // Glow
        this.ctx.shadowBlur = 30 * intensity;
        this.ctx.shadowColor = `rgb(${255 * intensity}, ${247 - (100 * intensity)}, 255)`;

        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(20, 20, 35, 0.9)`; // Dark fill
        this.ctx.fill();

        // Border gets brighter with output
        this.ctx.strokeStyle = `rgb(${255 * intensity}, 0, 255)`;
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        this.ctx.shadowBlur = 0; // Reset for text

        // Text inside neuron
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 14px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("LOGIC", cx, cy + 5);

        // 3. Output (Right line)
        this.ctx.beginPath();
        this.ctx.moveTo(cx + r, cy);
        this.ctx.lineTo(this.width - 20, cy);
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.lineWidth = 3 + (intensity * 4); // Thicker line when active
        this.ctx.stroke();

        this.ctx.fillStyle = '#bbb';
        this.ctx.font = '12px Outfit';
        this.ctx.textAlign = 'right';
        this.ctx.fillText("Output", this.width - 20, cy - 20);

        // Output Value Label
        this.ctx.fillStyle = '#ff00ff';
        this.ctx.font = 'bold 16px Outfit';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(this.neuronState.output.toFixed(2), this.width - 50, cy + 20);

        // Reset Alignment
        this.ctx.textAlign = 'left';
    }

    update(output) {
        this.neuronState.output = Math.max(0, Math.min(1, output)); // Clamp 0-1
        dom.brainOutput.textContent = this.neuronState.output.toFixed(2);
        this.draw();
    }
}

const brainViz = new BrainVisualizer(dom.brainCanvas);

/* --- LEVEL MANAGEMENT --- */
async function init() {
    try {
        const response = await fetch('content.json');
        appState.content = await response.json();
        renderLevel(appState.currentLevel);
        brainViz.draw();
    } catch (e) {
        console.error("Failed to load content:", e);
        log("System Error: Use 'python -m http.server' to view locally.", "error");
    }

    dom.toggleCode.addEventListener('click', () => {
        dom.codeDrawer.classList.toggle('collapsed');
    });

    dom.nextBtn.addEventListener('click', () => {
        if (appState.currentLevel < appState.maxLevels) {
            appState.currentLevel++;
            renderLevel(appState.currentLevel);
        }
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        appState.currentLevel = 1;
        renderLevel(1);
        log("System Reset.");
    });
}

function renderLevel(levelId) {
    const data = appState.content.levels.find(l => l.id === levelId);
    if (!data) return;

    // Update UI headers
    dom.levelText.textContent = data.title;
    dom.progressBar.style.width = `${(levelId / appState.maxLevels) * 100}%`;
    dom.codeBlock.textContent = data.codeSnippet;
    dom.nextBtn.classList.add('hidden'); // Hide until complete
    log(`Entering ${data.title}...`, 'info');

    // Clear and build content
    dom.levelContent.innerHTML = `
        <h2>${data.title}</h2>
        <p class="desc">${data.description}</p>
        <p class="instr"><strong>Mission:</strong> ${data.instruction}</p>
        <div id="level-workspace" style="margin-top: 2rem;"></div>
    `;

    const workspace = document.getElementById('level-workspace');

    // Dispatcher
    if (levelId === 1) setupLevel1(workspace, data);
    if (levelId === 2) setupLevel2(workspace, data);
    if (levelId === 3) setupLevel3(workspace, data);
    if (levelId === 4) setupLevel4(workspace, data);
}

/* --- LEVEL 1: DRAG & DROP --- */
function setupLevel1(container, data) {
    container.className = "matching-game";

    // Bio Terms (Draggable)
    const termsDiv = document.createElement('div');
    termsDiv.className = 'term-container';

    // Computer Concepts (Drop Zones)
    const zonesDiv = document.createElement('div');
    zonesDiv.className = 'drop-zone-container';

    let matches = 0;

    data.pairs.forEach(pair => {
        const term = document.createElement('div');
        term.className = 'draggable';
        term.draggable = true;
        term.textContent = pair.bio;
        term.id = pair.id; // Correct ID assignment
        term.dataset.match = pair.comp;

        term.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', pair.id); // store ID
        });

        termsDiv.appendChild(term);

        const zone = document.createElement('div');
        zone.className = 'drop-zone';
        zone.textContent = `[ ${pair.comp} ]`;
        zone.dataset.expect = pair.id; // store Expect ID

        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('over');
        });
        zone.addEventListener('dragleave', e => zone.classList.remove('over'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain');
            const draggable = document.getElementById(id);

            if (id === zone.dataset.expect) {
                // Match!
                zone.textContent = `${draggable.textContent} = ${pair.comp}`;
                zone.classList.remove('over');
                zone.classList.add('correct');
                draggable.style.display = 'none'; // hide original
                playSound('success');
                log(`Connected: ${pair.bio} -> ${pair.comp}`, 'success');
                matches++;
                brainViz.update(matches / 4); // Light up brain
                if (matches === 4) dom.nextBtn.classList.remove('hidden');
            } else {
                playSound('error');
                log("Mismatch! Try again.", "error");
                zone.classList.remove('over');
                dom.gameArea.classList.add('shake');
                setTimeout(() => dom.gameArea.classList.remove('shake'), 500);
            }
        });

        zonesDiv.appendChild(zone);
    });

    container.appendChild(termsDiv);
    container.appendChild(zonesDiv);
}

/* --- LEVEL 2: PERCEPTRON (Vibe Score) --- */
function setupLevel2(container, data) {
    container.className = "perceptron-controls";
    const inputs = data.inputs;
    const weights = data.weights;
    let bias = data.bias.default;

    // Helper to create slider
    const createSlider = (item, type) => {
        const group = document.createElement('div');
        group.className = 'control-group';
        group.innerHTML = `
            <label>${item.label}: <span id="val-${item.id}">${item.default}</span></label>
            <input type="range" id="${item.id}" min="${item.min}" max="${item.max}" step="${item.step || 1}" value="${item.default}">
        `;
        return group;
    };

    // Render Controls
    const inputsDiv = document.createElement('div');
    inputsDiv.innerHTML = "<h4>Inputs (Features)</h4>";
    inputs.forEach(i => inputsDiv.appendChild(createSlider(i, 'input')));

    const weightsDiv = document.createElement('div');
    weightsDiv.innerHTML = "<h4>Weights (Importance)</h4>";
    weights.forEach(w => weightsDiv.appendChild(createSlider(w, 'weight')));

    const biasDiv = document.createElement('div');
    biasDiv.innerHTML = "<h4>Bias (Offset)</h4>";
    biasDiv.appendChild(createSlider(data.bias, 'bias'));

    container.append(inputsDiv, weightsDiv, biasDiv);

    // Event Listeners
    const update = () => {
        const vals = {};
        [...inputs, ...weights, data.bias].forEach(item => {
            vals[item.id] = parseFloat(document.getElementById(item.id).value);
            document.getElementById(`val-${item.id}`).textContent = vals[item.id];
        });

        // Math: z = sum(xi * wi) + b
        let z = 0;
        inputs.forEach((inp, idx) => {
            const w = weights[idx];
            z += vals[inp.id] * vals[w.id];
        });
        z += vals[data.bias.id];

        // Sigmoid
        const y = 1 / (1 + Math.exp(-z));

        brainViz.update(y);
        log(`z = ${z.toFixed(2)} | Output = ${y.toFixed(4)}`);

        if (y > 0.8) {
            log("High Vibe Score! Decision: YES", 'success');
            dom.nextBtn.classList.remove('hidden');
        }
    };

    container.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', update);
    });

    update(); // Initial run
}

/* --- LEVEL 3: GRADIENT DESCENT --- */
function setupLevel3(container, data) {
    const parent = document.createElement('div');
    parent.className = 'mountain-game';

    const canvas = document.createElement('canvas');
    canvas.className = 'curve-canvas';
    canvas.width = 600;
    canvas.height = 400; // Match CSS
    parent.appendChild(canvas);

    const ball = document.createElement('div');
    ball.className = 'ball';
    parent.appendChild(ball);

    const trainBtn = document.createElement('button');
    trainBtn.className = 'glow-btn';
    trainBtn.textContent = 'Train Step (Update Weights)';
    trainBtn.style.marginTop = '1rem';

    container.appendChild(parent);
    container.appendChild(trainBtn);

    const ctx = canvas.getContext('2d');
    let currentWeight = -8; // Start far left
    const minWeight = 0;

    // Draw Curve: Loss = w^2 (Parabola)
    const drawCurve = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        // Map x (-10 to 10) to width (0 to 600)
        // Map y (0 to 100) to height (400 to 0)

        const mapX = (x) => (x + 10) * (canvas.width / 20);
        const mapY = (y) => canvas.height - (y * (canvas.height / 120));

        ctx.moveTo(mapX(-10), mapY(100)); // Start (-10)^2 = 100
        for (let x = -10; x <= 10; x += 0.5) {
            ctx.lineTo(mapX(x), mapY(x * x));
        }
        ctx.stroke();

        // Update Ball Position
        const ballX = mapX(currentWeight);
        const ballY = mapY(currentWeight * currentWeight);

        ball.style.left = `${ballX - 10}px`; // center
        ball.style.top = `${ballY - 10}px`;
    };

    drawCurve();

    trainBtn.addEventListener('click', () => {
        // Gradient Descent Logic
        // Loss = w^2 -> dLoss/dw = 2w
        const gradient = 2 * currentWeight;
        const learningRate = 0.2; // exaggerated for visual

        const oldW = currentWeight;
        currentWeight = currentWeight - (learningRate * gradient);

        log(`w: ${oldW.toFixed(2)} -> ${currentWeight.toFixed(2)} | Gradient: ${gradient.toFixed(2)}`);

        if (Math.abs(gradient) < 0.5) {
            playSound('success');
            log("Convergence Reached! Error minimized.", 'success');
            dom.nextBtn.classList.remove('hidden');
        } else {
            playSound(); // Simple beep
        }
        drawCurve();
    });
}

/* --- LEVEL 4: MLP VISUALIZER --- */
function setupLevel4(container, data) {
    container.className = "mlp-container";

    data.layers.forEach((layerName, layerIdx) => {
        const col = document.createElement('div');
        col.className = 'layer';

        col.innerHTML = `<div class="layer-title">${layerName}</div>`;

        const count = layerIdx === 1 ? 4 : (layerIdx === 2 ? 1 : 3); // 3 inputs, 4 hidden, 1 output

        for (let i = 0; i < count; i++) {
            const node = document.createElement('div');
            node.className = 'neuron';
            node.innerHTML = count === 1 ? '🍕' : (layerIdx === 0 ? ['🍅', '🧀', '🌿'][i] : '⚡');
            col.appendChild(node);

            node.addEventListener('mouseenter', () => {
                log(`Inspecting ${layerName}: Node ${i + 1}`);
                brainViz.update(Math.random()); // Random flicker
                playSound();
            });
        }
        container.appendChild(col);
    });

    log("Network fully connected.", 'success');
    setTimeout(() => {
        log("Training Complete! The AI can now predict Pizza orders.");
        alert("Congratulations! You've built a Neural Network!");
    }, 2000);
}

// Start
init();
