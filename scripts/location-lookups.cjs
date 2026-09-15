const { CITY_METADATA } = require("./res-data-importer.cjs");
const lookupData = require("../lib/domain/lookup-data.json");

function districtCode(regionId, sectionId) {
  return `legacy-${regionId}-${sectionId}`;
}

async function syncLocationLookupsInTransaction(tx) {
  let citiesCreated = 0;
  let districtsCreated = 0;
  let restaurantsBackfilled = 0;

  for (const region of lookupData.regions.filter((option) => option.id > 0)) {
    const metadata = CITY_METADATA[region.label];
    if (!metadata) throw new Error(`缺少縣市代碼：${region.label}`);

    const existingCity = await tx.city.findFirst({
      where: {
        OR: [
          { code: metadata.code },
          { name: region.label },
          { legacyRegion: region.id }
        ]
      }
    });
    const city = existingCity
      ? await tx.city.update({
          where: { id: existingCity.id },
          data: { code: metadata.code, name: region.label, legacyRegion: region.id }
        })
      : await tx.city.create({
          data: { code: metadata.code, name: region.label, legacyRegion: region.id }
        });
    if (!existingCity) citiesCreated += 1;

    const districts = lookupData.sectionsByRegion[String(region.id)] ?? [];
    for (const districtOption of districts) {
      const existingDistrict = await tx.district.findFirst({
        where: {
          cityId: city.id,
          OR: [
            { name: districtOption.label },
            { legacySection: districtOption.id }
          ]
        }
      });
      const district = existingDistrict
        ? await tx.district.update({
            where: { id: existingDistrict.id },
            data: { name: districtOption.label, legacySection: districtOption.id }
          })
        : await tx.district.create({
            data: {
              cityId: city.id,
              code: districtCode(region.id, districtOption.id),
              name: districtOption.label,
              legacySection: districtOption.id
            }
          });
      if (!existingDistrict) districtsCreated += 1;

      const backfill = await tx.restaurant.updateMany({
        where: {
          region: region.id,
          section: districtOption.id,
          OR: [
            { cityId: null },
            { cityId: { not: city.id } },
            { districtId: null },
            { districtId: { not: district.id } }
          ]
        },
        data: { cityId: city.id, districtId: district.id }
      });
      restaurantsBackfilled += backfill.count;
    }

    const cityOnlyBackfill = await tx.restaurant.updateMany({
      where: {
        region: region.id,
        section: 0,
        OR: [
          { cityId: null },
          { cityId: { not: city.id } },
          { districtId: { not: null } }
        ]
      },
      data: { cityId: city.id, districtId: null }
    });
    restaurantsBackfilled += cityOnlyBackfill.count;
  }

  return { citiesCreated, districtsCreated, restaurantsBackfilled };
}

async function syncLocationLookups(prisma) {
  return prisma.$transaction(
    (tx) => syncLocationLookupsInTransaction(tx),
    { maxWait: 30_000, timeout: 180_000 }
  );
}

module.exports = { districtCode, syncLocationLookups, syncLocationLookupsInTransaction };
