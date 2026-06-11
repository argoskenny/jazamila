import { renderListSectionLinks } from "@/lib/domain/sections";
import { htmlRequestError, htmlResponse, readRequestInput } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const input = await readRequestInput(request);
    const regionId = Number.parseInt(String(input.regionid ?? "0"), 10);
    return htmlResponse(renderListSectionLinks(regionId));
  } catch (error) {
    return htmlRequestError(error);
  }
}
