document.addEventListener('DOMContentLoaded', function() {
    const ROOT_URL = "http://127.0.0.1:8000";
    const IMAGE_ENDPOINT = `${ROOT_URL}/images/`;
    const exp2_no_of_images = 5;
    const exp2_range_of_images = 15;

    const canvasElement = document.getElementById('canvas');
    const startBtn = document.getElementById('startBtn');
    const submitBtn = document.getElementById('submitBtn');
    const undoBtn = document.getElementById('undoBtn');
    const realBtn = document.getElementById('realBtn');
    const fakeBtn = document.getElementById('fakeBtn');
    const controls = document.querySelector('.controls');
    const phase1Controls = document.querySelector('.phase1-controls');
    const phase2Controls = document.querySelector('.phase2-controls');
    const messageDiv = document.getElementById('message');

    const canvas = new fabric.Canvas('canvas', { 
        isDrawingMode: false,
        selection: false  
    });
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 10;
    canvas.freeDrawingBrush.color = 'rgba(255, 0, 0, 0.5)';

    let currentImageIndex = 0;
    const numImagesToSample = 5;
    const numImagesInDatabase = 20;
    let currentImageName = null;
    let imageList = [];
    let exp2ImageLists = [];
    let phase = 1;
    let drawnObjects = [];
    let userSelections = { noXAI: [], withXAI: [] };

    function getRandomSample(total, sampleSize) {
        const indices = Array.from({ length: total }, (_, i) => i + 1);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return indices.slice(0, sampleSize);
    }

    function generateImageList() {
        const sampledIndices = getRandomSample(numImagesInDatabase, numImagesToSample);
        imageList = sampledIndices.map(index => `image_${index}.png`);
    }

    function generateExp2ImageLists() {
        const totalImagesNeeded = exp2_no_of_images * 2;
        const realIndices = getRandomSample(exp2_range_of_images, totalImagesNeeded);
        const fakeIndices = getRandomSample(exp2_range_of_images, totalImagesNeeded);
        
        const realSingles = realIndices.slice(0, exp2_no_of_images);
        const realPairs = realIndices.slice(exp2_no_of_images);
        const fakeSingles = fakeIndices.slice(0, exp2_no_of_images);
        const fakePairs = fakeIndices.slice(exp2_no_of_images);

        const exp2Array1 = [];
        const exp2Array2 = [];
        const usedRealSingles = new Set();
        const usedFakeSingles = new Set();
        const usedRealPairs = new Set();
        const usedFakePairs = new Set();

        for (let i = 0; i < exp2_no_of_images; i++) {
            const useReal = Math.random() < 0.5;
            if (useReal && realSingles.length > 0) {
                const index = realSingles.shift();
                exp2Array1.push(`real_images/real_image_${index}.png`);
                usedRealSingles.add(index);
            } else if (fakeSingles.length > 0) {
                const index = fakeSingles.shift();
                exp2Array1.push(`fake_images/fake_image_${index}.png`);
                usedFakeSingles.add(index);
            } else {
                const index = realSingles.shift();
                exp2Array1.push(`real_images/real_image_${index}.png`);
                usedRealSingles.add(index);
            }
        }

        for (let i = 0; i < exp2_no_of_images; i++) {
            const useReal = Math.random() < 0.5;
            if (useReal && realPairs.length > 0) {
                const index = realPairs.shift();
                if (!usedRealSingles.has(index)) {
                    exp2Array2.push(`real_images/real_image_${index}.png`);
                    usedRealPairs.add(index);
                } else {
                    i--;
                }
            } else if (fakePairs.length > 0) {
                const index = fakePairs.shift();
                if (!usedFakeSingles.has(index)) {
                    exp2Array2.push(`fake_images/fake_image_${index}.png`);
                    usedFakePairs.add(index);
                } else {
                    i--;
                }
            } else {
                const index = realPairs.shift();
                if (!usedRealSingles.has(index)) {
                    exp2Array2.push(`real_images/real_image_${index}.png`);
                    usedRealPairs.add(index);
                } else {
                    i--;
                }
            }
        }

        return [exp2Array1, exp2Array2];
    }

    function loadSingleImage(imageName) {
        currentImageName = imageName;
        const url = (phase === 1) ? `${IMAGE_ENDPOINT}${imageName}` : `${ROOT_URL}/${imageName}`;
        console.log(`Attempting to fetch image: ${url}`);
    
        fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'image/png' },
            mode: 'cors',
            credentials: 'same-origin'
        })
        .then(response => {
            console.log(`Response received - Status: ${response.status}, OK: ${response.ok}`);
            console.log(`Response headers:`, response.headers);
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Fetch failed with status ${response.status}: ${text}`);
                });
            }
            return response.blob();
        })
        .then(blob => {
            console.log(`Blob received - Size: ${blob.size}, Type: ${blob.type}`);
            if (blob.size === 0) {
                throw new Error('Received empty blob - no image data');
            }
            const imgObj = new Image();
            imgObj.src = URL.createObjectURL(blob);
            imgObj.onload = function() {
                console.log(`Image loaded successfully - Dimensions: ${imgObj.width}x${imgObj.height}`);
                canvas.setWidth(imgObj.width);
                canvas.setHeight(imgObj.height);
                const fabricImg = new fabric.Image(imgObj, {
                    selectable: false,
                    evented: false
                });
                canvas.clear();
                drawnObjects = [];
                canvas.add(fabricImg);
                canvas.isDrawingMode = (phase === 1);
                canvas.renderAll();
            };
            imgObj.onerror = function() {
                console.error('Image failed to render from blob');
            };
        })
        .catch(error => {
            console.error('Full error details:', error);
            console.error('Error stack:', error.stack);
            alert('Error fetching image: ' + error.message);
        });
    }

    function loadImagePair(imageName) {
        fetch(`${ROOT_URL}/${imageName}?exp=true`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors',
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
            return response.json();
        })
        .then(data => {
            const mainImgUrl = `${ROOT_URL}${data.main_image}`;
            const expImgUrl = `${ROOT_URL}${data.exp_image}`;
            const mainImg = new Image();
            const expImg = new Image();
            let loadedCount = 0;

            function onImageLoad() {
                loadedCount++;
                if (loadedCount === 2) {
                    canvas.setWidth(mainImg.width * 2); 
                    canvas.setHeight(mainImg.height);   
                    const fabricMainImg = new fabric.Image(mainImg, { 
                        left: 0,                       
                        selectable: false,               
                        evented: false                 
                    });
                    const fabricExpImg = new fabric.Image(expImg, { 
                        left: mainImg.width,           
                        selectable: false,              
                        evented: false                
                    });
                    canvas.clear();
                    canvas.add(fabricMainImg, fabricExpImg);
                    canvas.isDrawingMode = false;
                    canvas.renderAll();
                }
            }

            mainImg.src = mainImgUrl;
            expImg.src = expImgUrl;
            mainImg.onload = onImageLoad;
            expImg.onload = onImageLoad;
        })
        .catch(error => {
            console.error('Error fetching image pair:', error);
            alert('Error fetching image pair: ' + error.message);
        });
    }

    canvas.on('path:created', function(e) {
        const path = e.path;
        drawnObjects.push(path);
    });

    function undoLastStroke() {
        if (drawnObjects.length > 0) {
            const lastPath = drawnObjects.pop();
            canvas.remove(lastPath);
            canvas.renderAll();
        }
    }

    function submitMask() {
        if (!currentImageName) {
            alert('No image loaded');
            return;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.clearRect(0, 0, canvas.width, canvas.height);

        canvas.forEachObject(function(obj) {
            if (obj.type !== 'image') {
                tempCtx.drawImage(obj.toCanvasElement(), obj.left || 0, obj.top || 0);
            }
        });

        const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const maskArray = Array(canvas.height).fill().map(() => Array(canvas.width).fill(0));
        for (let i = 0; i < pixels.length; i += 4) {
            const alpha = pixels[i + 3];
            if (alpha > 0) {
                const x = (i / 4) % canvas.width;
                const y = Math.floor((i / 4) / canvas.width);
                maskArray[y][x] = 1;
            }
        }

        const maskData = { image_name: currentImageName, mask: maskArray };
        fetch(`${ROOT_URL}/post-mask/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(maskData),
            mode: 'cors',
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to upload mask');
            return response.json();
        })
        .then(data => {
            currentImageIndex++;
            if (currentImageIndex < numImagesToSample) {
                loadSingleImage(imageList[currentImageIndex]);
            } else {
                phase = 2;
                exp2ImageLists = generateExp2ImageLists();
                currentImageIndex = 0;
                phase1Controls.style.display = 'none';
                phase2Controls.style.display = 'inline-block';
                loadNextPhase2Image();
            }
        })
        .catch(error => {
            console.error('Error uploading mask:', error);
            alert('Error uploading mask: ' + error.message);
        });
    }

    function calculateAccuracy() {
        let noXAI_correct = 0, withXAI_correct = 0;
        
        userSelections.noXAI.forEach(selection => {
            const isReal = selection.imageName.startsWith('real');
            const userSaidReal = selection.choice === 'real';
            if ((isReal && userSaidReal) || (!isReal && !userSaidReal)) {
                noXAI_correct++;
            }
        });

        userSelections.withXAI.forEach(selection => {
            const isReal = selection.imageName.startsWith('real');
            const userSaidReal = selection.choice === 'real';
            if ((isReal && userSaidReal) || (!isReal && !userSaidReal)) {
                withXAI_correct++;
            }
        });

        const noXAI_accuracy = `${noXAI_correct}/${exp2_no_of_images}`;
        const withXAI_accuracy = `${withXAI_correct}/${exp2_no_of_images}`;
        return { noXAI_accuracy, withXAI_accuracy };
    }


    function sendSelectionsToBackend() {
        console.log("Sending selections to backend:", userSelections);
        fetch(`${ROOT_URL}/post-selections/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userSelections),
            mode: 'cors',
            credentials: 'same-origin'
        })
        .then(response => {
            console.log("Response status:", response.status); 
            if (!response.ok) throw new Error('Failed to send selections');
            return response.json();
        })
        .then(data => console.log('Selections saved:', data))
        .catch(error => console.error('Error sending selections:', error));
    }

    function loadNextPhase2Image() {
        if (currentImageIndex < exp2_no_of_images * 2) {
            const arrayIndex = Math.floor(currentImageIndex / exp2_no_of_images);
            const imageIndex = currentImageIndex % exp2_no_of_images;
            const currentArray = exp2ImageLists[arrayIndex];
            const imageName = currentArray[imageIndex];
    
            if (arrayIndex === 0) {
                loadSingleImage(imageName);
            } else {
                loadImagePair(imageName);
            }
        } else {
            console.log("Phase 2 complete, calculating accuracy"); 
            canvasElement.style.display = 'none';
            controls.style.display = 'none';
            messageDiv.style.display = 'block';
            const accuracies = calculateAccuracy();
            messageDiv.textContent = `No XAI Accuracy: ${accuracies.noXAI_accuracy}, With XAI Accuracy: ${accuracies.withXAI_accuracy}`;
            sendSelectionsToBackend();
        }
    }

    startBtn.addEventListener('click', function() {
        startBtn.style.display = 'none';
        canvasElement.style.display = 'block';
        controls.style.display = 'block';
        phase1Controls.style.display = 'inline-block';
        phase2Controls.style.display = 'none';
        generateImageList();
        currentImageIndex = 0;
        phase = 1;
        loadSingleImage(imageList[0]);
    });

    submitBtn.addEventListener('click', submitMask);
    undoBtn.addEventListener('click', undoLastStroke);

    realBtn.addEventListener('click', function() {
        if (phase === 2) {
            const arrayIndex = Math.floor(currentImageIndex / exp2_no_of_images);
            const imageIndex = currentImageIndex % exp2_no_of_images;
            const imageName = exp2ImageLists[arrayIndex][imageIndex];
            const selection = { imageName, choice: 'real' };
            if (arrayIndex === 0) userSelections.noXAI.push(selection);
            else userSelections.withXAI.push(selection);
            currentImageIndex++;
            loadNextPhase2Image();
        }
    });

    fakeBtn.addEventListener('click', function() {
        if (phase === 2) {
            const arrayIndex = Math.floor(currentImageIndex / exp2_no_of_images);
            const imageIndex = currentImageIndex % exp2_no_of_images;
            const imageName = exp2ImageLists[arrayIndex][imageIndex];
            const selection = { imageName, choice: 'fake' };
            if (arrayIndex === 0) userSelections.noXAI.push(selection);
            else userSelections.withXAI.push(selection);
            currentImageIndex++;
            loadNextPhase2Image();
        }
    });
});