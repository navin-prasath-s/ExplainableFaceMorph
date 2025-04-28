document.addEventListener('DOMContentLoaded', function() {
    const BACKEND_URL = "https://49nd693cqe.execute-api.us-east-1.amazonaws.com/prod";
    const numImagesToSample = 5;
    const numImagesInDatabase = 20;
    const exp2_no_of_images = 5;
    const exp2_range_of_images = 10;

    const canvasElement = document.getElementById('canvas');
    const submitBtn = document.getElementById('submitBtn');
    const undoBtn = document.getElementById('undoBtn');
    const realBtn = document.getElementById('realBtn');
    const fakeBtn = document.getElementById('fakeBtn');
    const controls = document.querySelector('.controls');
    const phase1Controls = document.querySelector('.phase1-controls');
    const phase2Controls = document.querySelector('.phase2-controls');
    const messageDiv = document.getElementById('message');



    // Page elements
    const landingPage = document.getElementById('landingPage');
    const taskPage = document.getElementById('taskPage');
    const canvasApp = document.getElementById('canvasApp');
    const startSurveyBtn = document.getElementById('startSurveyBtn');
    const beginImagesBtn = document.getElementById('beginImagesBtn');

    // Initialize page visibility
    landingPage.style.display = 'block';
    taskPage.style.display = 'none';
    canvasApp.style.display = 'none';

    // Navigation event listeners
    startSurveyBtn.addEventListener('click', function() {
        landingPage.style.display = 'none';
        taskPage.style.display = 'block';
    });

    beginImagesBtn.addEventListener('click', function() {
        taskPage.style.display = 'none';
        canvasApp.style.display = 'block';
        controls.style.display = 'block';
        phase1Controls.style.display = 'inline-block';
        phase2Controls.style.display = 'none';
        generateImageList();
        currentImageIndex = 0;
        phase = 1;
        loadSingleImage(imageList[0]);
    });

    const canvas = new fabric.Canvas('canvas', { 
        isDrawingMode: false,
        selection: false 
    });

    canvasElement.style.display = 'none';
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 10;
    canvas.freeDrawingBrush.color = 'rgba(255, 0, 0, 0.5)';


    let currentImageIndex = 0;
    let currentImageName = null;
    let imageList = [];
    let exp2ImageLists = [];
    let phase = 1;
    let drawnObjects = [];
    let userSelections = { noXAI: [], withXAI: [] };



    // Utility Functions
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
            }
        }

        return [exp2Array1, exp2Array2];
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

    // API Call functions
    function loadSingleImage(imageName) {
        currentImageName = imageName;
        let url;
        if (imageName.includes('/')) {
            url = `${BACKEND_URL}/${imageName}`;
        } else {
            url = `${BACKEND_URL}/images/${imageName}`;
        }
        console.log('Fetching image from:', url);
        fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'image/png' }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }
            return response.text();
        })
        .then(base64String => {
            const imgObj = new Image();
            imgObj.src = `data:image/png;base64,${base64String}`;
            imgObj.onload = function() {
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
                // Show the canvas only after the image is loaded
                canvasElement.style.display = 'block';
            };
        })
        .catch(error => {
            console.error('Error fetching image:', error);
            alert('Error fetching image: ' + error.message);
        });
    }

    function loadImagePair(imageName) {
        const prefix = imageName.split('/')[0];
        const actualImageName = imageName.split('/')[1];
        const url = `${BACKEND_URL}/${prefix}/${actualImageName}?exp=true`;
        
        fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        })
        .then(response => {
            if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
            return response.json();
        })
        .then(data => {
            const mainImg = new Image();
            const expImg = new Image();
            let loadedCount = 0;
    
            mainImg.src = `data:image/png;base64,${data.main_image}`;
            expImg.src = `data:image/png;base64,${data.exp_image}`;
    
            function onImageLoad() {
                loadedCount++;
                if (loadedCount === 2) {
                    const spacing = 20;
                    canvas.setWidth(mainImg.width * 2 + spacing);
                    canvas.setHeight(mainImg.height);
                    const fabricMainImg = new fabric.Image(mainImg, {
                        left: 0,
                        selectable: false,
                        evented: false
                    });
                    const fabricExpImg = new fabric.Image(expImg, {
                        left: mainImg.width + spacing,
                        selectable: false,
                        evented: false
                    });
                    canvas.clear();
                    canvas.add(fabricMainImg, fabricExpImg);
                    canvas.isDrawingMode = false;
                    canvas.renderAll();
                    // Show the canvas only after both images are loaded
                    canvasElement.style.display = 'block';
                }
            }
    
            mainImg.onload = onImageLoad;
            expImg.onload = onImageLoad;
        })
        .catch(error => {
            console.error('Error fetching image pair:', error);
            alert(`Error fetching image pair for ${imageName}: ${error.message}`);
        });
    }


    function submitMask() {
        if (!currentImageName) {
            alert('No image loaded');
            return;
        }
    
        // Create a temporary canvas to extract the mask
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.clearRect(0, 0, canvas.width, canvas.height);
    
        // Draw only the non-image objects (i.e., the drawn paths) onto the temporary canvas
        canvas.forEachObject(function(obj) {
            if (obj.type !== 'image') {
                tempCtx.drawImage(obj.toCanvasElement(), obj.left || 0, obj.top || 0);
            }
        });
    
        // Convert the drawn paths into a binary mask array
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
    
        // Prepare the data to send to the Lambda endpoint
        const maskData = {
            image_name: currentImageName.split('/').pop(),
            mask: maskArray
        };
    
        // Hide the canvas immediately after submitting the mask
        canvasElement.style.display = 'none'; // <--- Add this line here
    
        // Send the mask to the /post_mask/ endpoint
        const url = `${BACKEND_URL}/post_mask/`;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(maskData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to upload mask: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Mask submitted successfully:', data);
            currentImageIndex++;
            if (currentImageIndex < numImagesToSample) {
                loadSingleImage(imageList[currentImageIndex]);
            } else {
                // Transition to Phase 2
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
        fetch(`${BACKEND_URL}/post_selection/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userSelections)
        })
        .then(response => {
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
    
            // Hide the canvas before loading the next image
            canvasElement.style.display = 'none';
            if (arrayIndex === 0) {
                loadSingleImage(imageName);
            } else {
                loadImagePair(imageName);
            }
        } else {
            canvasElement.style.display = 'none';
            controls.style.display = 'none';
            messageDiv.style.display = 'block';
            const accuracies = calculateAccuracy();
            messageDiv.textContent = `No XAI Accuracy: ${accuracies.noXAI_accuracy}, With XAI Accuracy: ${accuracies.withXAI_accuracy}`;
            sendSelectionsToBackend();
        }
    }

    // startBtn.addEventListener('click', function() {
    //     startBtn.style.display = 'none';
    //     controls.style.display = 'block';
    //     phase1Controls.style.display = 'inline-block';
    //     phase2Controls.style.display = 'none';
    //     generateImageList();
    //     currentImageIndex = 0;
    //     phase = 1;
    //     loadSingleImage(imageList[0]);
    // });

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

