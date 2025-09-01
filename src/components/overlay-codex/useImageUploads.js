import { useState, useCallback, useMemo } from 'react';

export default function useImageUploads() {
  const [imageAttachments, setImageAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback((files) => {
    const validImages = Array.from(files || []).filter(file => file.type && file.type.startsWith('image/')).slice(0, 5);
    validImages.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageAttachments(prev => [...prev, {
          id: `img-${Date.now()}-${Math.random()}`,
          dataUrl: e.target.result,
          name: file.name,
          size: file.size
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const onFileInputChange = useCallback((e) => {
    handleFiles(e.target.files);
  }, [handleFiles]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) handleFiles(files);
  }, [handleFiles]);

  const removeImageAttachment = useCallback((id) => {
    setImageAttachments(prev => prev.filter(img => img.id !== id));
  }, []);

  const clearImages = useCallback(() => setImageAttachments([]), []);

  return {
    imageAttachments,
    isDragging,
    onFileInputChange,
    onDragOver,
    onDragLeave,
    onDrop,
    removeImageAttachment,
    clearImages,
    // Allow external callers (e.g., paste handler) to add files directly
    addFiles: handleFiles
  };
}
