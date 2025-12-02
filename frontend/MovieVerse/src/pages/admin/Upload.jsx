import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadCloud, FileVideo, Image as ImageIcon, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [videoName, setVideoName] = useState(null);

  const [thumbFile, setThumbFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);

  // API Gateway URL (presigned URL generator)
  const API_ENDPOINT = "https://uc8f0ln1y7.execute-api.eu-north-1.amazonaws.com/dev/upload";

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!videoFile) {
      toast.error("Please select a video file.");
      return;
    }

    setIsLoading(true);

    const title = document.getElementById("title").value;
    const owner = document.getElementById("owner").value;
    const synopsis = document.getElementById("synopsis").value;

    try {
      // -------------------------------------------------------
      // STEP 1: SEND METADATA (JSON ONLY — NO FormData)
      // -------------------------------------------------------
      const metadataPayload = {
        filename: videoFile.name,
        thumbnail_name: thumbFile ? thumbFile.name : null,
        title,
        synopsis,
        owner
      };

      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadataPayload),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Metadata Error:", err);
        toast.error("Metadata upload failed.");
        setIsLoading(false);
        return;
      }

      const { videoUploadURL, thumbnailUploadURL } = await res.json();

      // -------------------------------------------------------
      // STEP 2: UPLOAD VIDEO TO S3 USING PRESIGNED URL
      // -------------------------------------------------------
      const uploadVideo = await fetch(videoUploadURL, {
        method: "PUT",
        body: videoFile,
      });

      if (!uploadVideo.ok) {
        throw new Error("Video upload to S3 failed");
      }

      // -------------------------------------------------------
      // STEP 3: UPLOAD THUMBNAIL IF EXISTS
      // -------------------------------------------------------
      if (thumbFile && thumbnailUploadURL) {
        const uploadThumb = await fetch(thumbnailUploadURL, {
          method: "PUT",
          body: thumbFile,
        });

        if (!uploadThumb.ok) {
          throw new Error("Thumbnail upload failed");
        }
      }

      toast.success("Upload successful!");
      navigate("/admin/manage");

    } catch (error) {
      console.error(error);
      toast.error("Upload failed: " + error.message);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pt-24 px-6 pb-20">
      <Navbar />

      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-heading font-bold text-white mb-2">Studio Uplink</h1>
          <p className="text-muted-foreground">Upload and distribute content to the MovieVerse.</p>
        </div>

        <Card className="bg-card/50 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-primary" /> Upload Media
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleUpload} className="space-y-6">

              {/* Title */}
              <div className="grid gap-2">
                <Label htmlFor="title" className="text-white">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter video title"
                  className="bg-white/5 border-white/10 text-white focus:border-primary"
                  required
                />
              </div>

              {/* Owner */}
              <div className="grid gap-2">
                <Label htmlFor="owner" className="text-white">Owner / Studio</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="owner"
                    defaultValue={user?.name}
                    className="pl-9 bg-white/5 border-white/10 text-white focus:border-primary"
                  />
                </div>
              </div>

              {/* Synopsis */}
              <div className="grid gap-2">
                <Label htmlFor="synopsis" className="text-white">Synopsis</Label>
                <Textarea
                  id="synopsis"
                  placeholder="Describe the movie..."
                  className="min-h-[120px] bg-white/5 border-white/10 text-white focus:border-primary"
                  required
                />
              </div>

              {/* Upload Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Thumbnail Upload */}
                <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center group cursor-pointer">
                  <Label htmlFor="thumb-upload" className="block cursor-pointer">
                    {thumbnailPreview ? (
                      <img
                        src={thumbnailPreview}
                        className="w-full h-40 object-cover rounded-md mb-3"
                      />
                    ) : (
                      <>
                        <div className="w-12 h-12 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-3">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-white text-sm">Thumbnail</p>
                        <p className="text-xs text-gray-500">JPG / PNG</p>
                      </>
                    )}
                  </Label>
                  <Input
                    id="thumb-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      setThumbFile(file);
                      setThumbnailPreview(file ? URL.createObjectURL(file) : null);
                    }}
                  />
                </div>

                {/* Video Upload */}
                <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center group cursor-pointer">
                  <Label htmlFor="video-upload" className="block cursor-pointer">
                    {videoName ? (
                      <p className="text-white">{videoName}</p>
                    ) : (
                      <>
                        <div className="w-12 h-12 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-3">
                          <FileVideo className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-white text-sm">Video Source</p>
                        <p className="text-xs text-gray-500">MP4 / MKV</p>
                      </>
                    )}
                  </Label>
                  <Input
                    id="video-upload"
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      setVideoFile(file);
                      setVideoName(file ? file.name : null);
                    }}
                  />
                </div>

              </div>

              <Button
                type="submit"
                variant="neon"
                className="w-full h-12 text-lg"
                disabled={isLoading}
              >
                {isLoading ? "Uploading..." : "Publish Content"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
