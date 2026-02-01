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
    toggleCode: document.getElementById('toggle-code'),
    levelNav: document.getElementById('level-nav')
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
        const r = 50;

        // 1. Inputs (Dendrites)
        this.ctx.lineWidth = 3;
        const inputY = [cy - 60, cy, cy + 60];

        inputY.forEach(y => {
            this.ctx.beginPath();
            this.ctx.moveTo(20, y);
            this.ctx.lineTo(cx - r, cy);
            this.ctx.strokeStyle = '#007bff';
            this.ctx.stroke();
        });

        // Label: Dendrites
        this.ctx.fillStyle = '#007bff';
        this.ctx.font = 'bold 12px Outfit';
        this.ctx.fillText("Dendrites", 10, cy - 80);
        this.ctx.fillStyle = '#555';
        this.ctx.fillText("(Inputs)", 10, cy - 65);

        // Label: Synapse (on the line)
        this.ctx.fillStyle = '#cc6600'; // Dark Orange for Synapse
        this.ctx.fillText("Synapse", 80, cy - 40);
        this.ctx.fillStyle = '#555';
        this.ctx.fillText("(Weight)", 80, cy - 25);


        // 2. Neuron Body (Cell Body)
        const intensity = this.neuronState.output;

        // Glow
        this.ctx.shadowBlur = 30 * intensity;
        this.ctx.shadowColor = `rgb(${255 * intensity}, ${247 - (100 * intensity)}, 255)`;

        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.fillStyle = `#ffffff`;
        this.ctx.fill();

        this.ctx.strokeStyle = `rgb(${255 * intensity}, 0, 255)`;
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        this.ctx.shadowBlur = 0;

        // Label: Cell Body
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 14px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("Cell Body", cx, cy - 10);
        this.ctx.font = '12px Outfit';
        this.ctx.fillStyle = '#555';
        this.ctx.fillText("(Summation)", cx, cy + 10);

        // 3. Output (Axon)
        this.ctx.beginPath();
        this.ctx.moveTo(cx + r, cy);
        this.ctx.lineTo(this.width - 20, cy);
        this.ctx.strokeStyle = '#cc0000'; // Dark Red
        this.ctx.lineWidth = 3 + (intensity * 4);
        this.ctx.stroke();

        // Label: Axon
        this.ctx.fillStyle = '#cc0000'; // Dark Red
        this.ctx.textAlign = 'right';
        this.ctx.font = 'bold 12px Outfit';
        this.ctx.fillText("Axon", this.width - 40, cy - 20);
        this.ctx.fillStyle = '#555';
        this.ctx.fillText("(Output)", this.width - 40, cy - 5);

        // Output Value Label
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 16px Outfit';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`y = ${this.neuronState.output.toFixed(2)}`, this.width - 60, cy + 20);

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

    renderNav();
}

function renderNav() {
    dom.levelNav.innerHTML = '';
    for (let i = 1; i <= appState.maxLevels; i++) {
        const circle = document.createElement('div');
        circle.className = `nav-circle ${i === appState.currentLevel ? 'active' : ''}`;
        circle.textContent = i;
        circle.addEventListener('click', () => {
            appState.currentLevel = i;
            renderLevel(i);
        });
        dom.levelNav.appendChild(circle);
    }
}

function updateNavState(levelId) {
    const circles = dom.levelNav.querySelectorAll('.nav-circle');
    circles.forEach((c, idx) => {
        if (idx + 1 === levelId) c.classList.add('active');
        else c.classList.remove('active');
    });
}

function renderLevel(levelId) {
    const data = appState.content.levels.find(l => l.id === levelId);
    if (!data) return;

    // Update UI headers
    dom.levelText.textContent = `Level ${levelId}: ${data.title}`;
    dom.progressBar.style.width = `${(levelId / appState.maxLevels) * 100}%`;
    dom.codeBlock.textContent = data.codeSnippet;
    dom.nextBtn.classList.add('hidden'); // Hide until complete
    updateNavState(levelId);
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
    inputsDiv.className = 'perceptron-section inputs';
    inputsDiv.innerHTML = "<h4>My Situation (Inputs)</h4><p style='color:#a0a0b0; font-size:0.9rem; margin-bottom:1rem;'>The Facts: Am I sleepy? Is it raining? Rate my Attendance (0-10).</p>";
    inputs.forEach(i => inputsDiv.appendChild(createSlider(i, 'input')));

    const weightsDiv = document.createElement('div');
    weightsDiv.className = 'perceptron-section weights';
    weightsDiv.innerHTML = "<h4>My Priorities (Weights)</h4><p style='color:#a0a0b0; font-size:0.9rem; margin-bottom:1rem;'>Positive = Excuses (Bed). Negative = Duty (Class).</p>";
    weights.forEach(w => weightsDiv.appendChild(createSlider(w, 'weight')));

    const biasDiv = document.createElement('div');
    biasDiv.className = 'perceptron-section bias';
    biasDiv.innerHTML = "<h4>My Baseline (Bias)</h4><p style='color:#a0a0b0; font-size:0.9rem; margin-bottom:1rem;'>Am I generally lazy today?</p>";
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
        log(`Laziness Score (z) = ${z.toFixed(2)} | Probability to Skip = ${(y * 100).toFixed(1)}%`);

        if (y > 0.5) {
            log("RESULT: TOO LAZY 🛌 (SKIP)", 'error');
            // Using error color for 'bad' behavior (skipping class)
            dom.nextBtn.classList.remove('hidden');
        } else {
            log("RESULT: DUTY WINS 🎓 (GO)", 'success');
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

    // Info Panel for Story
    const infoPanel = document.createElement('div');
    infoPanel.style.position = 'absolute';
    infoPanel.style.top = '10px';
    infoPanel.style.left = '10px';
    infoPanel.style.color = '#000';
    infoPanel.style.zIndex = '10';
    infoPanel.innerHTML = `
        <div style="margin-bottom:5px;">🎯 <strong>True Sales:</strong> $10,400</div>
        <div style="margin-bottom:5px;">🤖 <strong>AI Guess:</strong> <span id="current-guess" style="color:#cc0000">$12,310</span></div>
        <div>📉 <strong>Error (Cost):</strong> <span id="current-error" style="color:#cc6600">High</span></div>
    `;
    parent.appendChild(infoPanel);

    const canvas = document.createElement('canvas');
    canvas.className = 'curve-canvas';
    canvas.width = 600;
    canvas.height = 400;
    parent.appendChild(canvas);

    const ball = document.createElement('div');
    ball.className = 'ball';
    parent.appendChild(ball);

    const trainBtn = document.createElement('button');
    trainBtn.className = 'glow-btn';
    trainBtn.textContent = 'Train Step (Push Ball Down)';
    trainBtn.style.marginTop = '1rem';

    container.appendChild(parent);
    container.appendChild(trainBtn);

    const ctx = canvas.getContext('2d');

    // Simulation State
    let currentError = -8;

    const drawCurve = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw Axis & Labels
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Y-Axis
        ctx.moveTo(canvas.width / 2, 20);
        ctx.lineTo(canvas.width / 2, canvas.height - 20);
        ctx.stroke();

        ctx.fillStyle = '#aaa';
        ctx.font = '12px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText("HIGH COST ($$$ Lost)", canvas.width / 2, 40);
        ctx.fillText("ZERO COST (Perfection)", canvas.width / 2, canvas.height - 10);

        // 2. Draw Parabola (The Error Mountain)
        ctx.beginPath();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;

        const mapX = (x) => (x + 10) * (canvas.width / 20);
        const mapY = (y) => canvas.height - (y * (canvas.height / 120)) - 30; // Shifted up slightly

        ctx.moveTo(mapX(-10), mapY(100));
        for (let x = -10; x <= 10; x += 0.5) {
            ctx.lineTo(mapX(x), mapY(x * x));
        }
        ctx.stroke();

        // 3. Update Ball Position
        const ballX = mapX(currentError);
        const ballY = mapY(currentError * currentError);

        ball.style.left = `${ballX - 10}px`;
        ball.style.top = `${ballY - 10}px`;

        // 4. Update Text Stats
        const guessVal = 10.4 + (Math.abs(currentError) * 0.238);
        document.getElementById('current-guess').textContent = `$${(guessVal * 1000).toLocaleString().split('.')[0]}`;

        const costVal = Math.floor(currentError * currentError * 100);
        document.getElementById('current-error').textContent = `$${costVal} (Loss)`;
    };

    drawCurve();

    trainBtn.addEventListener('click', () => {
        // Gradient: slope = 2*x
        const gradient = 2 * currentError;
        const learningRate = 0.2;

        const oldError = currentError;
        // Move opposite to gradient to minimize
        currentError = currentError - (learningRate * gradient);

        log(`Prediction closer! Cost dropped from ${Math.floor(oldError ** 2 * 100)} to ${Math.floor(currentError ** 2 * 100)}`);

        if (Math.abs(currentError) < 0.5) {
            currentError = 0; // Snap to finish
            drawCurve();
            document.getElementById('current-error').textContent = "$0 (Perfect!)";
            document.getElementById('current-guess').textContent = "$10,400";

            playSound('success');
            log("SUCCESS! The AI reached the bottom of the Valley of Error.", 'success');
            dom.nextBtn.classList.remove('hidden');
            trainBtn.disabled = true;
            trainBtn.textContent = "Model Trained";
        } else {
            playSound();
            drawCurve();
        }
    });
}

/* --- LEVEL 4: MLP VISUALIZER --- */
/* --- LEVEL 4: MLP VISUALIZER (The AI Chef) --- */
function setupLevel4(container, data) {
    container.className = "mlp-container";

    // Store nodes for line drawing
    const allLayers = [];

    // Define specific roles for the Hidden Layer (The Tasters)
    const hiddenRoles = [
        { icon: '🧂', name: 'Salty Scanner', desc: 'Checks for Cheese' },
        { icon: '🍅', name: 'Acidity Detector', desc: 'Checks for Tomato' },
        { icon: '🌿', name: 'Aroma Analyst', desc: 'Smells the Basil' },
        { icon: '⚖️', name: 'Balance Bot', desc: 'Checks ratio of All Ingredients' }
    ];

    data.layers.forEach((layerName, layerIdx) => {
        const col = document.createElement('div');
        col.className = 'layer';
        col.id = `layer-${layerIdx}`;
        col.innerHTML = `<div class="layer-title">${layerName}</div>`;

        const count = layerIdx === 1 ? 4 : (layerIdx === 2 ? 1 : 3);
        const layerNodes = [];

        for (let i = 0; i < count; i++) {
            const node = document.createElement('div');
            node.className = 'neuron';
            node.dataset.layer = layerIdx;
            node.dataset.idx = i;

            // Assign Content based on Layer
            if (layerIdx === 0) {
                // Input: Ingredients
                const labels = ['🍅', '🧀', '🌿'];
                const names = ['Tomato', 'Cheese', 'Basil'];
                node.innerHTML = labels[i];
                node.dataset.role = names[i];
            } else if (layerIdx === 1) {
                // Hidden: Tasters
                node.innerHTML = hiddenRoles[i].icon;
                node.dataset.role = hiddenRoles[i].name;
                node.dataset.desc = hiddenRoles[i].desc;
                // Add a small tooltip-like label below
                const label = document.createElement('div');
                label.style.fontSize = '10px';
                label.style.marginTop = '5px';
                label.style.color = '#555';
                label.innerText = hiddenRoles[i].name.split(' ')[0]; // Short name
                node.appendChild(label);
            } else {
                // Output: Pizza check
                node.innerHTML = '🍕';
                node.dataset.role = "Final Verdict";
            }

            // Interaction
            node.addEventListener('mouseenter', () => {
                activatePath(layerIdx, i, allLayers);

                // Smart Logging based on Layer
                if (layerIdx === 0) {
                    log(`Input '${node.dataset.role}' is being sent to ALL Tasters (Hidden Layer) to be analyzed.`, 'info');
                } else if (layerIdx === 1) {
                    log(`Hidden Neuron '${node.dataset.role}': "${node.dataset.desc}"`, 'success');
                } else {
                    log("Output: The Chef combines all Taster reports to decide: PIZZA!", 'success');
                }

                playSound();
            });

            node.addEventListener('mouseleave', () => {
                clearPaths();
            });

            col.appendChild(node);
            layerNodes.push(node);
        }
        allLayers.push(layerNodes);
        container.appendChild(col);
    });

    // Canvas for lines
    const canvas = document.createElement('canvas');
    canvas.id = 'mlp-lines';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '0';
    container.style.position = 'relative';
    container.insertBefore(canvas, container.firstChild);

    // Draw Lines Logic
    function activatePath(activeLayer, activeIdx, layers) {
        const ctx = canvas.getContext('2d');
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        layers[activeLayer][activeIdx].classList.add('active');

        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        // Strategy: 
        // 1. If Input hovered -> Show lines to ALL Hidden (Yellow)
        // 2. If Hidden hovered -> Show lines from ALL Inputs (Cyan) AND to Output (Yellow)

        if (activeLayer === 0) {
            // Input -> Hidden
            ctx.strokeStyle = '#cc6600'; // Dark Orange
            connectToNextLayer(ctx, layers[0][activeIdx], layers[1]);
        } else if (activeLayer === 1) {
            // Input -> Hidden (Backwards trace)
            ctx.strokeStyle = '#007bff'; // Blue for "Sources"
            connectFromPrevLayer(ctx, layers[1][activeIdx], layers[0]);

            // Hidden -> Output (Forward trace)
            ctx.strokeStyle = '#cc6600'; // Dark Orange
            connectToNextLayer(ctx, layers[1][activeIdx], layers[2]);
        } else if (activeLayer === 2) {
            // Hidden -> Output (Backwards)
            ctx.strokeStyle = '#007bff'; // Blue
            connectFromPrevLayer(ctx, layers[2][activeIdx], layers[1]);
        }
    }

    function connectToNextLayer(ctx, sourceNode, targetNodes) {
        targetNodes.forEach(target => {
            drawLine(ctx, sourceNode, target);
        });
    }

    function connectFromPrevLayer(ctx, targetNode, sourceNodes) {
        sourceNodes.forEach(source => {
            drawLine(ctx, source, targetNode);
        });
    }

    function drawLine(ctx, n1, n2) {
        const r1 = n1.getBoundingClientRect();
        const r2 = n2.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();

        const x1 = r1.left + r1.width / 2 - cRect.left;
        const y1 = r1.top + r1.height / 2 - cRect.top;
        const x2 = r2.left + r2.width / 2 - cRect.left;
        const y2 = r2.top + r2.height / 2 - cRect.top;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.globalAlpha = 0.6;
        ctx.stroke();
    }

    function clearPaths() {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.querySelectorAll('.neuron').forEach(n => n.classList.remove('active'));
    }

    log("The AI Kitchen is ready. Hover over the 'Taste Testers' (Middle Layer) to see what they do!", 'info');
}


// Start
init();
