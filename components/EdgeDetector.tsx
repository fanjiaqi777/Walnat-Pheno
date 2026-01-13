import React, { useRef, useEffect, useState } from 'react';

export type ViewMode = 'original' | 'overlay' | 'sketch' | 'mask';

// Scientific Metrics Interface
export interface PhenotypicData {
  grooveDensity: number;    // 0.0 - 1.0 (Percentage of surface area that is groove)
  fractalDimension: number; // 1.0 - 2.0 (Complexity of the pattern via Box Counting)
  fragmentationCount: number; // Approximate number of disconnected features (Blob count)
  processingTimeMs: number;
}

interface EdgeDetectorProps {
  imageSrc: string;
  onProcessed?: () => void;
  onPhenotypesCalculated?: (data: PhenotypicData) => void;
  mode: ViewMode;
}

const EdgeDetector: React.FC<EdgeDetectorProps> = ({ imageSrc, mode, onProcessed, onPhenotypesCalculated }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.src = imageSrc;

    img.onload = () => {
      if (!canvasRef.current) return;

      const maxWidth = 800;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (mode !== 'original') {
        setIsProcessing(true);
        // Use requestAnimationFrame or setTimeout to allow UI to update before heavy calc
        setTimeout(() => {
          if (!canvasRef.current) return;
          const startTime = performance.now();
          const phenotypes = applyHighContrastSobel(ctx, canvas.width, canvas.height, mode);
          const endTime = performance.now();
          
          setIsProcessing(false);
          if (onProcessed) onProcessed();
          
          if (phenotypes && onPhenotypesCalculated) {
            onPhenotypesCalculated({
                ...phenotypes,
                processingTimeMs: Math.round(endTime - startTime)
            });
          }
        }, 50);
      } else {
         if (onProcessed) onProcessed();
      }
    };
    
    img.onerror = () => {
      console.error("Failed to load image for processing");
      setIsProcessing(false);
    };

  }, [imageSrc, mode, onProcessed]); // Added onPhenotypesCalculated to deps effectively

  // --- SCIENTIFIC ALGORITHMS ---

  // 1. Box Counting Method for Fractal Dimension estimation
  // This is a simplified implementation suitable for the browser thread
  const calculateFractalDimension = (binaryData: Uint8ClampedArray, width: number, height: number): number => {
    // We only care about "hit" pixels (value > 0).
    // Scales: check boxes of size 2, 4, 8, 16, 32, 64
    const scales = [2, 4, 8, 16, 32, 64];
    const counts = [];

    for (let s of scales) {
        let count = 0;
        // Iterate through grid
        for (let y = 0; y < height; y += s) {
            for (let x = 0; x < width; x += s) {
                // Check if any pixel in this box is active
                let hasDetail = false;
                checkLoop:
                for (let by = 0; by < s; by++) {
                    if (y + by >= height) break;
                    for (let bx = 0; bx < s; bx++) {
                        if (x + bx >= width) break;
                        const idx = ((y + by) * width + (x + bx)); // Single channel index
                        if (binaryData[idx] > 0) {
                            hasDetail = true;
                            break checkLoop;
                        }
                    }
                }
                if (hasDetail) count++;
            }
        }
        if (count > 0) counts.push({ scale: s, count });
    }

    if (counts.length < 2) return 1.0;

    // Calculate slope of log(count) vs log(1/scale)
    // Linear regression: y = mx + c
    // D = - slope
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = counts.length;

    for (let point of counts) {
        const x = Math.log(1 / point.scale);
        const y = Math.log(point.count);
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope; // Fractal Dimension is the slope (usually between 1 and 2 for surfaces)
  };

  const applyHighContrastSobel = (ctx: CanvasRenderingContext2D, width: number, height: number, mode: ViewMode): Omit<PhenotypicData, 'processingTimeMs'> | null => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const inputBuffer = new Uint8ClampedArray(data);

    // 1. Grayscale
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const r = inputBuffer[i * 4];
        const g = inputBuffer[i * 4 + 1];
        const b = inputBuffer[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // 2. Blur (Low pass)
    const blurPasses = 1; 
    let srcBuffer = gray;
    let dstBuffer = new Float32Array(width * height);

    for (let pass = 0; pass < blurPasses; pass++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
                    dstBuffer[idx] = srcBuffer[idx]; continue;
                }
                let sum = srcBuffer[idx] * 4;
                sum += (srcBuffer[idx - 1] + srcBuffer[idx + 1] + srcBuffer[idx - width] + srcBuffer[idx + width]) * 2;
                sum += (srcBuffer[idx - width - 1] + srcBuffer[idx - width + 1] + srcBuffer[idx + width - 1] + srcBuffer[idx + width + 1]);
                dstBuffer[idx] = sum / 16;
            }
        }
        if (pass < blurPasses - 1) {
            const temp = srcBuffer; srcBuffer = dstBuffer; dstBuffer = temp;
        }
    }
    const blurred = dstBuffer;

    // 3. Sobel (Edge detection)
    const outputData = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const gx = (-1 * blurred[idx - width - 1]) + (1 * blurred[idx - width + 1]) + (-2 * blurred[idx - 1]) + (2 * blurred[idx + 1]) + (-1 * blurred[idx + width - 1]) + (1 * blurred[idx + width + 1]);
            const gy = (-1 * blurred[idx - width - 1]) + (-2 * blurred[idx - width]) + (-1 * blurred[idx - width + 1]) + (1 * blurred[idx + width - 1]) + (2 * blurred[idx + width]) + (1 * blurred[idx + width + 1]);
            outputData[idx] = Math.sqrt(gx * gx + gy * gy);
        }
    }

    // 3.5 Dynamic Thresholding Calculation
    let dynamicThreshold = 50; 
    let maxGrooveScoreFound = 0;
    const buckets = 1000;
    const histogram = new Uint32Array(buckets); 
    const totalPixels = width * height;

    for (let i = 0; i < totalPixels; i++) {
            const lum = gray[i];
            const darkness = 255 - lum;
            const edge = outputData[i];
            const rawScore = darkness + (edge * 3.0); 
            const bucketIndex = Math.min(buckets - 1, Math.floor(rawScore));
            histogram[bucketIndex]++;
            if (bucketIndex > maxGrooveScoreFound) maxGrooveScoreFound = bucketIndex;
    }

    const percentileTarget = 0.25; 
    const targetCount = totalPixels * percentileTarget;
    let accumulator = 0;
    for (let i = maxGrooveScoreFound; i >= 0; i--) {
        accumulator += histogram[i];
        if (accumulator > targetCount) {
            dynamicThreshold = i;
            break;
        }
    }
    dynamicThreshold = Math.max(40, dynamicThreshold);

    // --- PHENOTYPIC DATA COLLECTION ARRAYS ---
    // We create a separate binary mask specifically for calculations, regardless of view mode
    const scientificMask = new Uint8ClampedArray(width * height); // 1 = groove, 0 = flat
    let groovePixelCount = 0;
    let walnutPixelCount = 0; // Approximate area of the nut itself (non-black pixels)

    // 4. Render & Data Collection
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const pixelStart = idx * 4;
        
        let edgeStrength = outputData[idx];
        const lum = gray[idx];
        
        // Data Collection Logic
        // Determine if pixel is part of the walnut object (simple darkness threshold for background)
        // This assumes a relatively dark/black background or distinct object.
        // A simple heuristic: if average neighboring brightness > 10, it's object.
        // For simplicity, we count all pixels that aren't pitch black in original image.
        if (lum > 15) { 
            walnutPixelCount++;
        }

        // Determine groove status for science mask
        const darkness = 255 - lum;
        const grooveScore = darkness + (edgeStrength * 3.0);
        
        if (grooveScore > dynamicThreshold) {
            scientificMask[idx] = 1;
            groovePixelCount++;
        } else {
            scientificMask[idx] = 0;
        }

        // --- VISUAL RENDER LOGIC (View Modes) ---
        if (mode === 'mask') {
             if (grooveScore > dynamicThreshold) {
                 const range = maxGrooveScoreFound - dynamicThreshold;
                 let normalized = (grooveScore - dynamicThreshold) / (range || 1);
                 if (normalized > 1) normalized = 1;
                 if (normalized < 0) normalized = 0;
                 const curvedIntensity = Math.pow(normalized, 1.2);
                 const minBrightness = 60; 
                 const finalBrightness = Math.floor(minBrightness + (curvedIntensity * (255 - minBrightness)));

                 data[pixelStart] = finalBrightness;
                 data[pixelStart + 1] = finalBrightness;
                 data[pixelStart + 2] = finalBrightness;
                 data[pixelStart + 3] = 255;
             } else {
                 data[pixelStart] = 0; data[pixelStart + 1] = 0; data[pixelStart + 2] = 0; data[pixelStart + 3] = 255;
             }
        } else if (mode === 'sketch') {
            const threshold = 10; 
            let e = edgeStrength < threshold ? 0 : edgeStrength;
            if (e > 0) {
                let norm = (e - threshold) / 80; if(norm > 1) norm = 1;
                e = Math.pow(norm, 0.6) * 255;
            }
            const ink = Math.min(255, e);
            const paperValue = 255 - ink;
            data[pixelStart] = paperValue; data[pixelStart + 1] = paperValue; data[pixelStart + 2] = paperValue; data[pixelStart + 3] = 255;
        } else {
            // Overlay
            const dimFactor = 0.3; 
            data[pixelStart] = inputBuffer[pixelStart] * dimFactor;
            data[pixelStart + 1] = inputBuffer[pixelStart + 1] * dimFactor;
            data[pixelStart + 2] = inputBuffer[pixelStart + 2] * dimFactor;
            data[pixelStart + 3] = 255;

            const threshold = 10; 
            let e = edgeStrength < threshold ? 0 : edgeStrength;
            if (e > 0) {
                 let norm = (e - threshold) / 80; if(norm > 1) norm = 1;
                 e = Math.pow(norm, 0.6) * 255;
            }

            if (e > 10) {
                const alpha = e / 255;
                let whiteBoost = alpha > 0.75 ? (alpha - 0.75) * 4 * 255 : 0;
                data[pixelStart] = Math.min(255, data[pixelStart] + whiteBoost);
                data[pixelStart + 1] = Math.min(255, data[pixelStart + 1] + (255 * alpha) + whiteBoost);
                data[pixelStart + 2] = Math.min(255, data[pixelStart + 2] + (255 * alpha) + whiteBoost);
            }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // --- CALCULATE PHENOTYPES ---
    const fd = calculateFractalDimension(scientificMask, width, height);
    // Avoid division by zero
    const gd = walnutPixelCount > 0 ? (groovePixelCount / walnutPixelCount) : 0;

    return {
        grooveDensity: gd,
        fractalDimension: fd,
        fragmentationCount: 0 // Placeholder, connected component labeling is too heavy for this pass right now
    };
  };

  return (
    <div className="relative w-full flex justify-center bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700 min-h-[300px]">
      <canvas ref={canvasRef} className="max-w-full h-auto" />
      {isProcessing && (
         <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
           <div className="flex flex-col items-center space-y-2">
             <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
             <div className="text-cyan-400 font-mono text-sm">Computing Phenotypes...</div>
           </div>
         </div>
      )}
    </div>
  );
};

export default EdgeDetector;