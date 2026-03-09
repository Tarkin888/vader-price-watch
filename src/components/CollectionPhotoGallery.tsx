import { useState, useRef, useCallback } from "react";
import { Plus, X, Images } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CollectionItem } from "@/lib/collection-db";

interface Props {
  items: CollectionItem[];
  onUpdated: () => void;
}

interface GalleryImage {
  url: string;
  itemId: string;
  itemDesc: string;
  index: number;
}

const THUMB_W = "w-32";   // 2× ImageDropCell's w-16
const THUMB_H = "h-48";   // 2× ImageDropCell's h-24

const CollectionPhotoGallery = ({ items, onUpdated }: Props) => {
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; desc: string } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null); // `${itemId}-${index}`
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Flatten all gallery images from all items
  const allImages: GalleryImage[] = items.flatMap((item) =>
    (item.image_urls ?? []).map((url, index) => ({
      url,
      itemId: item.id,
      itemDesc: item.description,
      index,
    }))
  );

  const uploadImage = useCallback(async (file: File, targetItemId?: string) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported");
      return;
    }

    // Use first item if no specific target (drop on zone)
    const itemId = targetItemId ?? items[0]?.id;
    if (!itemId) {
      toast.error("No collection items found to attach images to");
      return;
    }

    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const currentUrls = item.image_urls ?? [];
      const { error } = await supabase
        .from("collection")
        .update({ image_urls: [...currentUrls, dataUrl] } as any)
        .eq("id", itemId);
      if (error) {
        toast.error("Failed to save image: " + error.message);
      } else {
        toast.success("Photo added to gallery");
        onUpdated();
      }
    };
    reader.readAsDataURL(file);
  }, [items, onUpdated]);

  const handleZoneDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingItemId(null);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await uploadImage(file);
    }
  }, [uploadImage]);

  const handleThumbnailDrop = useCallback(async (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingItemId(null);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await uploadImage(file, itemId);
    }
  }, [uploadImage]);

  const handleDelete = async (e: React.MouseEvent, img: GalleryImage) => {
    e.stopPropagation();
    const item = items.find((i) => i.id === img.itemId);
    if (!item) return;
    const updated = (item.image_urls ?? []).filter((_, i) => i !== img.index);
    const { error } = await supabase
      .from("collection")
      .update({ image_urls: updated } as any)
      .eq("id", img.itemId);
    if (error) {
      toast.error("Failed to remove image: " + error.message);
    } else {
      toast.success("Photo removed");
      onUpdated();
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      await uploadImage(file);
    }
    e.target.value = "";
  };

  const [zoneDragging, setZoneDragging] = useState(false);

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onDragOver={(e) => { e.preventDefault(); setZoneDragging(true); }}
        onDragLeave={() => setZoneDragging(false)}
        onDrop={handleZoneDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 cursor-pointer transition-colors ${
          zoneDragging
            ? "border-primary bg-primary/10"
            : "border-border/50 hover:border-primary/50 hover:bg-secondary/30"
        }`}
      >
        <Images className="w-6 h-6 text-muted-foreground" />
        <p className="text-[11px] tracking-widest text-muted-foreground">
          DROP PHOTOS HERE OR CLICK TO BROWSE · UNLIMITED
        </p>
        <p className="text-[10px] text-muted-foreground/60 tracking-wider">
          IMAGES ARE ATTACHED TO THE FIRST COLLECTION ITEM IF NOT DROPPED ON A SPECIFIC ONE
        </p>
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
      {allImages.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {allImages.map((img) => {
            const key = `${img.itemId}-${img.index}`;
            return (
              <div
                key={key}
                className={`relative ${THUMB_W} ${THUMB_H} border rounded-sm overflow-hidden cursor-pointer flex-shrink-0 transition-colors ${
                  draggingItemId === img.itemId
                    ? "border-primary"
                    : "border-border hover:border-primary/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDraggingItemId(img.itemId); }}
                onDragLeave={() => setDraggingItemId(null)}
                onDrop={(e) => handleThumbnailDrop(e, img.itemId)}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setLightbox({ url: img.url, desc: img.itemDesc })}
                title={img.itemDesc}
              >
                <img
                  src={img.url}
                  alt={img.itemDesc}
                  className="w-full h-full object-cover"
                />
                {/* Item label */}
                <div className="absolute bottom-0 inset-x-0 bg-background/70 px-1 py-0.5">
                  <span className="text-[8px] tracking-wider text-foreground truncate block">{img.itemDesc}</span>
                </div>
                {/* Delete on hover */}
                {hovered === key && (
                  <button
                    onClick={(e) => handleDelete(e, img)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Per-item add slots: show one "add" cell per item */}
          {items.map((item) => (
            <div
              key={`add-${item.id}`}
              className={`relative ${THUMB_W} ${THUMB_H} border border-dashed border-border/50 rounded-sm overflow-hidden cursor-pointer flex items-center justify-center flex-shrink-0 transition-colors hover:border-primary/50 hover:bg-secondary/30`}
              onDragOver={(e) => { e.preventDefault(); setDraggingItemId(item.id); }}
              onDragLeave={() => setDraggingItemId(null)}
              onDrop={(e) => handleThumbnailDrop(e, item.id)}
              onClick={() => {
                const inp = document.createElement("input");
                inp.type = "file";
                inp.accept = "image/*";
                inp.multiple = true;
                inp.onchange = async () => {
                  const files = Array.from(inp.files ?? []);
                  for (const file of files) await uploadImage(file, item.id);
                };
                inp.click();
              }}
              title={`Add photo to ${item.description}`}
            >
              <div className="flex flex-col items-center gap-1">
                <Plus className="w-4 h-4 text-muted-foreground" />
                <span className="text-[8px] tracking-wider text-muted-foreground text-center px-1 leading-tight">
                  {item.item_id}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Images className="w-10 h-10 opacity-30" />
          <p className="text-xs tracking-widest">NO PHOTOS YET — DROP IMAGES ABOVE TO GET STARTED</p>
        </div>
      )}

      {/* Count */}
      {allImages.length > 0 && (
        <p className="text-[10px] tracking-widest text-muted-foreground">
          {allImages.length} PHOTO{allImages.length !== 1 ? "S" : ""} ACROSS {items.length} ITEM{items.length !== 1 ? "S" : ""}
        </p>
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
          <div className="flex flex-col items-center gap-3">
            <img
              src={lightbox.url}
              alt={lightbox.desc}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-xs tracking-wider text-white/70">{lightbox.desc}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionPhotoGallery;
