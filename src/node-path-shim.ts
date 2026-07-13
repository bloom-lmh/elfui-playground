const normalize = (value: string): string => value.replace(/\\/g, "/");

const browserPath = {
  basename: (value: string): string => normalize(value).split("/").pop() ?? "",
  dirname: (value: string): string => {
    const parts = normalize(value).split("/");
    parts.pop();
    return parts.join("/");
  },
  join: (...parts: string[]): string => parts.filter(Boolean).join("/").replace(/\/+/g, "/")
};

export default browserPath;
