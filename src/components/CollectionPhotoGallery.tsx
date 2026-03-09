import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, X, Images, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BUCKET = "gallery";

interface GalleryPhoto {
  name: string;
  url: string;
}

const CollectionPhotoGallery = () => {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [zoneDragging, setZoneDragging] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async () => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).list("", {
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      const mapped: GalleryPhoto[] = (data ?? [])
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
        }));
      setPhotos(mapped);
    } catch (e: any) {
      toast.error("Failed to load gallery: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const uploadFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("Only image files are supported");
      return;
    }
    setUploading(true);
    let successCount = 0;
    for (const file of imageFiles) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
      } else {
        successCount++;
      }
    }
    setUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount} photo${successCount > 1 ? "s" : ""} added`);
      loadPhotos();
    }
  }, [loadPhotos]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setZoneDragging(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  }, [uploadFiles]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) await uploadFiles(files);
    e.target.value = "";
  };

  const handleDelete = async (e: React.MouseEvent, photo: GalleryPhoto) => {
    e.stopPropagation();
    const { error } = await supabase.storage.from(BUCKET).remove([photo.name]);
    if (error) {
      toast.error("Failed to delete photo: " + error.message);
    } else {
      toast.success("Photo deleted");
      setPhotos((prev) => prev.filter((p) => p.name !== photo.name));
      if (lightbox?.name === photo.name) setLightbox(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setZoneDragging(true); }}
        onDragLeave={() => setZoneDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 cursor-pointer transition-colors ${
          zoneDragging
            ? "border-primary bg-primary/10"
            : "border-border/50 hover:border-primary/50 hover:bg-secondary/30"
        }`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-[11px] tracking-widest text-muted-foreground">UPLOADING...</p>
          </>
        ) : (
          <>
            <Images className="w-6 h-6 text-muted-foreground" />
            <p className="text-[11px] tracking-widest text-muted-foreground">
              DROP PHOTOS HERE OR CLICK TO BROWSE · MULTIPLE FILES SUPPORTED
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Gallery grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : photos.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-3">
            {photos.map((photo) => (
              <div
                key={photo.name}
                className="relative w-32 h-48 border border-border rounded-sm overflow-hidden cursor-pointer flex-shrink-0 transition-colors hover:border-primary/50"
                onMouseEnter={() => setHovered(photo.name)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setLightbox(photo)}
              >
                <img
                  src={photo.url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {hovered === photo.name && (
                  <button
                    onClick={(e) => handleDelete(e, photo)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Inline add button */}
            <div
              className="relative w-32 h-48 border border-dashed border-border/50 rounded-sm overflow-hidden cursor-pointer flex items-center justify-center flex-shrink-0 hover:border-primary/50 hover:bg-secondary/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          <p className="text-[10px] tracking-widest text-muted-foreground">
            {photos.length} PHOTO{photos.length !== 1 ? "S" : ""}
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Images className="w-10 h-10 opacity-30" />
          <p className="text-xs tracking-widest">NO PHOTOS YET — DROP IMAGES ABOVE TO GET STARTED</p>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-card/80 text-foreground flex items-center justify-center hover:bg-card transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox.url}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default CollectionPhotoGallery;
