/**
 * Binary parser definitions for PRO file format
 */
import { Parser } from "binary-parser";

// Common header parser (24 bytes, 0x00-0x17)
export const headerParser = new Parser()
    .endianness("big")
    .uint32("objectTypeAndId")
    .uint32("textId")
    .uint32("frmTypeAndId")
    .uint32("lightRadius")
    .uint32("lightIntensity")
    .uint32("flags");

// Item common fields (0x18-0x38)
export const itemCommonParser = new Parser()
    .endianness("big")
    .bit24("flagsExt")
    .uint8("attackModes")
    .uint32("scriptId")
    .uint32("subType")
    .uint32("materialId")
    .uint32("size")
    .uint32("weight")
    .uint32("cost")
    .int32("inventoryFrmId")
    .uint8("soundId");

// Armor subtype
export const armorParser = new Parser()
    .endianness("big")
    .uint32("ac")
    .uint32("drNormal")
    .uint32("drLaser")
    .uint32("drFire")
    .uint32("drPlasma")
    .uint32("drElectrical")
    .uint32("drEmp")
    .uint32("drExplosion")
    .uint32("dtNormal")
    .uint32("dtLaser")
    .uint32("dtFire")
    .uint32("dtPlasma")
    .uint32("dtElectrical")
    .uint32("dtEmp")
    .uint32("dtExplosion")
    .uint32("perk")
    .int32("maleFrmId")
    .int32("femaleFrmId");

// Container subtype
export const containerParser = new Parser()
    .endianness("big")
    .uint32("maxSize")
    .uint32("openFlags");

// Drug subtype (stats are signed for -1/-2 special values)
export const drugParser = new Parser()
    .endianness("big")
    .int32("stat0")
    .int32("stat1")
    .int32("stat2")
    .uint32("amount0Instant")
    .uint32("amount1Instant")
    .uint32("amount2Instant")
    .uint32("duration1")
    .uint32("amount0Delayed1")
    .uint32("amount1Delayed1")
    .uint32("amount2Delayed1")
    .uint32("duration2")
    .uint32("amount0Delayed2")
    .uint32("amount1Delayed2")
    .uint32("amount2Delayed2")
    .uint32("addictionRate")
    .uint32("addictionEffect")
    .uint32("addictionOnset");

// Weapon subtype
export const weaponParser = new Parser()
    .endianness("big")
    .uint32("animCode")
    .uint32("minDamage")
    .uint32("maxDamage")
    .uint32("damageType")
    .uint32("maxRange1")
    .uint32("maxRange2")
    .int32("projectilePid")
    .uint32("minStrength")
    .uint32("apCost1")
    .uint32("apCost2")
    .uint32("criticalFail")
    .uint32("perk")
    .uint32("rounds")
    .uint32("caliber")
    .int32("ammoPid")
    .uint32("maxAmmo")
    .uint8("soundId");

// Ammo subtype
export const ammoParser = new Parser()
    .endianness("big")
    .uint32("caliber")
    .uint32("quantity")
    .uint32("acModifier")
    .uint32("drModifier")
    .uint32("damageMultiplier")
    .uint32("damageDivisor");

// Misc item subtype
export const miscItemParser = new Parser()
    .endianness("big")
    .int32("powerPid")
    .uint32("powerType")
    .uint32("charges");

// Key subtype
export const keyParser = new Parser()
    .endianness("big")
    .uint32("keyCode");

// Critter parser - complete 416 byte format
export const critterParser = new Parser()
    .endianness("big")
    .uint32("flagsExt")
    .uint32("scriptId")
    .int32("headFrmId")
    .uint32("aiPacket")
    .uint32("teamNumber")
    .uint32("critterFlags")
    // Base primary stats
    .uint32("strength")
    .uint32("perception")
    .uint32("endurance")
    .uint32("charisma")
    .uint32("intelligence")
    .uint32("agility")
    .uint32("luck")
    // Base secondary stats
    .uint32("hitPoints")
    .uint32("actionPoints")
    .uint32("armorClass")
    .uint32("unarmedDamage")
    .uint32("meleeDamage")
    .uint32("carryWeight")
    .uint32("sequence")
    .uint32("healingRate")
    .uint32("criticalChance")
    .uint32("betterCriticals")
    // Base damage thresholds
    .uint32("dtNormal")
    .uint32("dtLaser")
    .uint32("dtFire")
    .uint32("dtPlasma")
    .uint32("dtElectrical")
    .uint32("dtEmp")
    .uint32("dtExplosive")
    // Base damage resistances
    .uint32("drNormal")
    .uint32("drLaser")
    .uint32("drFire")
    .uint32("drPlasma")
    .uint32("drElectrical")
    .uint32("drEmp")
    .uint32("drExplosive")
    .uint32("drRadiation")
    .uint32("drPoison")
    // Demographics
    .uint32("age")
    .uint32("gender")
    // Bonus primary stats
    .int32("strengthBonus")
    .int32("perceptionBonus")
    .int32("enduranceBonus")
    .int32("charismaBonus")
    .int32("intelligenceBonus")
    .int32("agilityBonus")
    .int32("luckBonus")
    // Bonus secondary stats
    .int32("hitPointsBonus")
    .int32("actionPointsBonus")
    .int32("armorClassBonus")
    .int32("unarmedDamageBonus")
    .int32("meleeDamageBonus")
    .int32("carryWeightBonus")
    .int32("sequenceBonus")
    .int32("healingRateBonus")
    .int32("criticalChanceBonus")
    .int32("betterCriticalsBonus")
    // Bonus damage thresholds
    .int32("dtNormalBonus")
    .int32("dtLaserBonus")
    .int32("dtFireBonus")
    .int32("dtPlasmaBonus")
    .int32("dtElectricalBonus")
    .int32("dtEmpBonus")
    .int32("dtExplosiveBonus")
    // Bonus damage resistances
    .int32("drNormalBonus")
    .int32("drLaserBonus")
    .int32("drFireBonus")
    .int32("drPlasmaBonus")
    .int32("drElectricalBonus")
    .int32("drEmpBonus")
    .int32("drExplosiveBonus")
    .int32("drRadiationBonus")
    .int32("drPoisonBonus")
    // Bonus demographics
    .int32("ageBonus")
    .int32("genderBonus")
    // Skills
    .int32("skillSmallGuns")
    .int32("skillBigGuns")
    .int32("skillEnergyWeapons")
    .int32("skillUnarmed")
    .int32("skillMelee")
    .int32("skillThrowing")
    .int32("skillFirstAid")
    .int32("skillDoctor")
    .int32("skillSneak")
    .int32("skillLockpick")
    .int32("skillSteal")
    .int32("skillTraps")
    .int32("skillScience")
    .int32("skillRepair")
    .int32("skillSpeech")
    .int32("skillBarter")
    .int32("skillGambling")
    .int32("skillOutdoorsman")
    // Final fields
    .uint32("bodyType")
    .uint32("expValue")
    .uint32("killType")
    .uint32("damageType");

// Scenery common parser
export const sceneryCommonParser = new Parser()
    .endianness("big")
    .uint16("wallLightFlags")
    .uint16("actionFlags")
    .uint32("scriptId")
    .uint32("subType")
    .uint32("materialId")
    .uint8("soundId");

// Scenery subtype parsers
export const doorParser = new Parser()
    .endianness("big")
    .uint32("walkThruFlag")
    .uint32("unknown");

export const stairsParser = new Parser()
    .endianness("big")
    .uint32("destTileAndElevation")
    .uint32("destMap");

export const elevatorParser = new Parser()
    .endianness("big")
    .uint32("elevatorType")
    .uint32("elevatorLevel");

export const ladderParser = new Parser()
    .endianness("big")
    .uint32("destTileAndElevation");

export const genericSceneryParser = new Parser()
    .endianness("big")
    .uint32("unknown");

// Wall parser
export const wallParser = new Parser()
    .endianness("big")
    .uint16("wallLightFlags")
    .uint16("actionFlags")
    .uint32("scriptId")
    .uint32("materialId");

// Tile parser
export const tileParser = new Parser()
    .endianness("big")
    .uint32("materialId");

// Misc parser
export const miscParser = new Parser()
    .endianness("big")
    .uint32("unknown");

// Export parser result types
export type HeaderData = ReturnType<typeof headerParser.parse>;
export type ItemCommonData = ReturnType<typeof itemCommonParser.parse>;
export type ArmorData = ReturnType<typeof armorParser.parse>;
export type ContainerData = ReturnType<typeof containerParser.parse>;
export type DrugData = ReturnType<typeof drugParser.parse>;
export type WeaponData = ReturnType<typeof weaponParser.parse>;
export type AmmoData = ReturnType<typeof ammoParser.parse>;
export type MiscItemData = ReturnType<typeof miscItemParser.parse>;
export type KeyData = ReturnType<typeof keyParser.parse>;
export type CritterData = ReturnType<typeof critterParser.parse>;
export type SceneryCommonData = ReturnType<typeof sceneryCommonParser.parse>;
export type DoorData = ReturnType<typeof doorParser.parse>;
export type StairsData = ReturnType<typeof stairsParser.parse>;
export type ElevatorData = ReturnType<typeof elevatorParser.parse>;
export type LadderData = ReturnType<typeof ladderParser.parse>;
export type GenericSceneryData = ReturnType<typeof genericSceneryParser.parse>;
export type WallData = ReturnType<typeof wallParser.parse>;
export type TileData = ReturnType<typeof tileParser.parse>;
export type MiscData = ReturnType<typeof miscParser.parse>;
