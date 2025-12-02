import api from "./api";

export const getVideos = async () => {
  const res = await api.get("/videos");
  return res.data;
};
