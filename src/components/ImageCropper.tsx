"use client";

import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check } from 'lucide-react';

interface ImageCropperProps {
  imageFile: File;
  onCancel: () => void;
  onCropComplete: (croppedBlob: Blob, originalName: string) => void;
}

export default function ImageCropper({ imageFile, onCancel, onCropComplete }: ImageCropperProps) {
  const [imgSrc, setImgSrc] = useState('');
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setCrop(undefined);
    const reader = new FileReader();
    reader.addEventListener('load', () =>
      setImgSrc(reader.result?.toString() || '')
    );
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    // Default crop to 95% of the image
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 95,
        },
        width / height,
        width,
        height
      ),
      width,
      height
    );
    setCrop(crop);
  }

  async function handleConfirm() {
    if (!imgRef.current || !completedCrop) {
      // If user didn't move crop at all, return original
      onCropComplete(imageFile, imageFile.name);
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const image = imgRef.current;
      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('No 2d context');
      }

      const pixelRatio = window.devicePixelRatio;
      canvas.width = Math.floor(completedCrop.width * scaleX * pixelRatio);
      canvas.height = Math.floor(completedCrop.height * scaleY * pixelRatio);

      ctx.scale(pixelRatio, pixelRatio);
      ctx.imageSmoothingQuality = 'high';

      const cropX = completedCrop.x * scaleX;
      const cropY = completedCrop.y * scaleY;
      const cropWidth = completedCrop.width * scaleX;
      const cropHeight = completedCrop.height * scaleY;

      ctx.drawImage(
        image,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            console.error('Canvas is empty');
            setIsProcessing(false);
            return;
          }
          // The crop is successful
          onCropComplete(blob, imageFile.name);
        },
        imageFile.type || 'image/jpeg',
        0.95 // JPEG Quality
      );
    } catch (e) {
      console.error('Error cropping image:', e);
      // Fallback to original
      onCropComplete(imageFile, imageFile.name);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/50 pt-8 sm:pt-4">
        <div>
          <h2 className="text-white font-bold text-lg">Crop Document</h2>
          <p className="text-gray-400 text-xs">Drag the corners to remove the background.</p>
        </div>
        <button onClick={onCancel} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
        {!!imgSrc && (
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            className="max-h-full max-w-full rounded-xl shadow-2xl shadow-black overflow-visible"
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={imgSrc}
              onLoad={onImageLoad}
              className="max-h-[70vh] w-auto object-contain"
            />
          </ReactCrop>
        )}
      </div>

      <div className="p-4 bg-black/50 border-t border-white/10 flex justify-end gap-3 pb-8">
        <button
          onClick={onCancel}
          className="px-6 py-3 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={isProcessing}
          className="px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition flex items-center shadow-lg shadow-blue-500/30"
        >
          {isProcessing ? 'Processing...' : (
            <>
              <Check className="w-5 h-5 mr-2" />
              Confirm & Upload
            </>
          )}
        </button>
      </div>
    </div>
  );
}
