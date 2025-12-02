import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Pencil, Trash2, Eye, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function Manage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL =
    "https://rhcfyb5drj.execute-api.eu-north-1.amazonaws.com/dev/getVideoData";

  // -------------------------------
  // Fetch Videos from DynamoDB
  // -------------------------------
  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setVideos(data);
    } catch (err) {
      console.error("Error fetching videos:", err);
    }
    setLoading(false);
  };

  // -------------------------------
  // Delete Video (Frontend Only)
  // -------------------------------
  const handleDelete = (id) => {
    setVideos(videos.filter((v) => v.id !== id));
    toast.success("Video removed");
  };

  // -------------------------------
  // Search Filter
  // -------------------------------
  const filtered = videos.filter((v) =>
    v.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pt-24 px-6 pb-20 text-white">
      <Navbar />

      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold">Content Management</h1>
            <p className="text-muted-foreground">
              Manage your video library stored in DynamoDB.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search videos..."
              className="pl-9 bg-white/5 border-white/10 text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border border-white/10 overflow-hidden bg-card/30 backdrop-blur-sm">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/10 hover:bg-white/5">
                <TableHead className="text-gray-300 w-[100px]">Thumbnail</TableHead>
                <TableHead className="text-gray-300">Title</TableHead>
                <TableHead className="text-gray-300">Synopsis</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-right text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan="5" className="text-center py-10">
                    Loading videos...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan="5" className="text-center py-10 text-muted-foreground">
                    No videos found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((video) => (
                  <TableRow key={video.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      <div className="w-16 h-10 rounded-md overflow-hidden bg-black">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                    </TableCell>

                    {/* TITLE */}
                    <TableCell className="font-semibold">{video.title}</TableCell>

                    {/*Synopsis*/}
                    <TableCell className="text-sm text-gray-400 max-w-xs truncate">
                      {video.synopsis || "No description available"}
                    </TableCell>

                    {/* STATUS */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-400 border-green-500/20"
                      >
                        Active
                      </Badge>
                    </TableCell>

                    {/* ACTIONS */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10 text-white">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="bg-background border-white/10 text-white">
                          <DropdownMenuItem className="focus:bg-white/10 cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" /> Preview
                          </DropdownMenuItem>

                          <DropdownMenuItem className="focus:bg-white/10 cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" /> Edit Details
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-red-400 focus:bg-red-500/10 cursor-pointer"
                            onClick={() => handleDelete(video.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
