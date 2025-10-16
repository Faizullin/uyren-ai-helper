import { Log } from "@/lib/logger";
import { connectToDatabase } from "@workspace/common-logic/lib/db";
import { IDomain } from "@workspace/common-logic/models/organization.types";
import { WebsiteSettingsModel } from "@workspace/common-logic/models/pages/website-settings.model";
import { IWebsiteSettings } from "@workspace/common-logic/models/pages/website-settings.types";
import mongoose from "mongoose";
import { BaseCacheManager, RedisNotUsedError } from "./redis";

export class WebsiteSettingsManager extends BaseCacheManager {
    private static readonly CACHE_PREFIX = "website_settings:";
    private static readonly MANAGER_NAME = "WebsiteSettingsManager";

    /**
     * Get website settings with automatic Redis/database fallback
     */
    static async get(orgId: mongoose.Types.ObjectId): Promise<IWebsiteSettings | null> {
        const cacheKey = `${this.CACHE_PREFIX}orgId:${orgId}`;

        return await this.handleRedisOperation(
            async () => {
                const cached = await this.getFromCache<IWebsiteSettings>(cacheKey, this.MANAGER_NAME);
                if (cached) {
                    return cached;
                }
                throw new RedisNotUsedError(this.MANAGER_NAME);
            },
            async () => {
                await connectToDatabase();
                const settings = await WebsiteSettingsModel.findOne({
                    orgId: orgId,
                }).lean();

                if (settings) {
                    // Cache the result
                    await this.cache(orgId, settings);


                    const serialized = {
                        ...settings,
                        _id: settings?._id.toString(),
                        orgId: settings?.orgId.toString(),
                    };
                    return serialized as unknown as IWebsiteSettings;
                }

                return null;
            }
        );
    }

    /**
     * Get or create website settings (returns existing or creates default)
     */
    static async getOrCreate(domain: IDomain) {
        let settings = await this.get(domain.orgId);

        if (!settings) {
            settings = await this.createDefault(domain.orgId);
        }

        return settings;
    }

    /**
     * Create default website settings for an organization
     */
    private static async createDefault(orgId: mongoose.Types.ObjectId): Promise<IWebsiteSettings> {
        try {
            await connectToDatabase();
            const created = await WebsiteSettingsModel.create({
                orgId: orgId,
                mainPage: {
                    showBanner: true,
                    bannerTitle: "Welcome to Our Learning Platform",
                    bannerSubtitle: "Discover amazing courses and grow your skills",
                    featuredCourses: [],
                    featuredReviews: [],
                    showStats: true,
                    showFeatures: true,
                    showTestimonials: true,
                },
            });
            const createdObj = created.toJSON();
            await this.cache(orgId, createdObj);
            return createdObj;
        } catch (error) {
            Log.error("[WebsiteSettingsManager.createDefault] Database operation failed:", error as Error);
            throw error;
        }
    }

    /**
     * Invalidate cache for an organization (useful when settings are updated)
     */
    static async invalidateCache(orgId: mongoose.Types.ObjectId | string): Promise<void> {
        const cacheKey = `${this.CACHE_PREFIX}orgId:${orgId}`;

        try {
            await this.deleteFromCache([cacheKey], this.MANAGER_NAME);
        } catch (error) {
            if (error instanceof RedisNotUsedError) {
                return;
            }
            Log.error(`[${this.MANAGER_NAME}] Cache removal failed:`, error as Error);
        }
    }

    /**
     * Cache website settings in Redis
     */
    private static async cache(orgId: mongoose.Types.ObjectId | string, settings: IWebsiteSettings): Promise<void> {
        // Ensure consistent cache key format
        const objectId = typeof orgId === 'string'
            ? new mongoose.Types.ObjectId(orgId)
            : orgId;

        const cacheKey = `${this.CACHE_PREFIX}orgId:${objectId.toString()}`;

        try {
            await this.setCache(cacheKey, settings, this.DEFAULT_CACHE_TTL, this.MANAGER_NAME);
        } catch (error) {
            if (error instanceof RedisNotUsedError) {
                return;
            }
            Log.error(`[${this.MANAGER_NAME}] Redis caching failed:`, error as Error);
        }
    }
}

export default WebsiteSettingsManager;
