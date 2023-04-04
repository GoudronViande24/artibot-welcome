import Localizer from "artibot-localizer";
import Artibot, { Global, Module, log } from "artibot";
import { Snowflake, Guild, GuildBasedChannel, ColorResolvable, EmbedBuilder } from "discord.js";

import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

export class ArtibotWelcomeNotificationConfig {
	activate: boolean = false;
	channel?: Snowflake;
	showMemberCount: boolean = false;
	showProfilePicture: boolean = false;
	customInfo?: string;
}

export class ArtibotWelcomeServerConfig {
	name?: string;
	welcome: ArtibotWelcomeNotificationConfig = new ArtibotWelcomeNotificationConfig();
	farewell: ArtibotWelcomeNotificationConfig = new ArtibotWelcomeNotificationConfig();

	/**
	 * Set the server name
	 * @param name The server name
	 */
	public setName(name: string): this {
		this.name = name;
		return this;
	}

	/**
	 * Configure the welcome message
	 * @param callback Callback function to create the welcome configuration
	 */
	public setWelcomeConfig(callback: (welcome: ArtibotWelcomeNotificationConfig) => ArtibotWelcomeNotificationConfig): this {
		const welcome: ArtibotWelcomeNotificationConfig = this.welcome;
		const newWelcome: ArtibotWelcomeNotificationConfig = callback(welcome);
		this.welcome = newWelcome;
		return this;
	}

	/**
	 * Configure the farewell message
	 * @param callback Callback function to create the farewell configuration
	 */
	public setFarewellConfig(callback: (farewell: ArtibotWelcomeNotificationConfig) => ArtibotWelcomeNotificationConfig): this {
		const farewell: ArtibotWelcomeNotificationConfig = this.farewell;
		const newFarewell: ArtibotWelcomeNotificationConfig = callback(farewell);
		this.farewell = newFarewell;
		return this;
	}
}

/**
 * Configuration utility for Artibot Welcome module
 * @author GoudronViande24
 * @since 4.0.0
 */
export class ArtibotWelcomeConfig {
	servers: {
		[key: Snowflake]: ArtibotWelcomeServerConfig;
	} = {};

	/**
	 * Configure a server
	 * @param id The server ID
	 * @param callback Callback function to create the server configuration
	 */
	public addServer(id: Snowflake, callback: (server: ArtibotWelcomeServerConfig) => ArtibotWelcomeServerConfig): this {
		const server: ArtibotWelcomeServerConfig = new ArtibotWelcomeServerConfig();
		const newServer: ArtibotWelcomeServerConfig = callback(server);
		this.servers[id] = newServer;
		return this;
	}
}

let welcomeConfig: ArtibotWelcomeConfig;
const localizer: Localizer = new Localizer({
	filePath: path.resolve(__dirname, "../locales.json")
});

/**
 * Welcome module for Artibot
 * @author GoudronViande24
 * @license MIT
 */
export default function artibotWelcome(artibot: Artibot, config: ArtibotWelcomeConfig): Module {
	localizer.setLocale(artibot.config.lang);

	// Make sure the config is valid
	if (!config) throw new Error("No configuration file provided.");
	// Make sure the config has all the required properties
	if (!config.servers || Object.keys(config.servers).length === 0) throw new Error("No server configuration provided.");
	welcomeConfig = config;

	return new Module({
		id: "welcome",
		name: "Welcome",
		langs: [
			"en",
			"fr"
		],
		version,
		repo: "GoudronViande24/artibot-welcome",
		packageName: "artibot-welcome",
		parts: [
			new Global({
				id: "welcome",
				mainFunction
			})
		]
	});
}

async function mainFunction({ client, config, config: { debug }, createEmbed }: Artibot): Promise<void> {
	const { servers } = welcomeConfig;

	// Welcome
	client!.on("guildMemberAdd", async (member): Promise<void> => {
		if (debug) log("Welcome", localizer.__("[[0]] joined [[1]]", { placeholders: [member.user.username, member.guild.name] }), "debug");

		// If there is nothing in the config for this server, skip.
		if (!(member.guild.id in servers)) {
			if (debug) log("Welcome", localizer.__("[[0]] is not in configuration.", { placeholders: [member.guild.name] }), "debug");
			return;
		}

		const guild: Guild = member.guild;
		const guildConfig: ArtibotWelcomeServerConfig = servers[member.guild.id];
		// If welcome is not activated for the server, skip.
		if (!guildConfig.welcome.activate) return;
		if (!guildConfig.welcome.channel) {
			log("Welcome", localizer.__("No welcome channel set for [[0]]", { placeholders: [guild.name] }), "warn");
			return;
		}

		const welcomeChannel: GuildBasedChannel | null = await member.guild.channels.fetch(guildConfig.welcome.channel);
		if (!welcomeChannel) {
			log("Welcome", localizer.__("Welcome channel not found for [[0]]", { placeholders: [guild.name] }), "warn");
			return;
		}
		if (!welcomeChannel.isTextBased()) {
			log("Welcome", localizer.__("Welcome channel is not text based for [[0]]", { placeholders: [guild.name] }), "warn");
			return;
		}

		// Create content for the embed, based on preferences from the config
		let content: string = localizer.__("Welcome in [[0]] server!", { placeholders: [(guildConfig.name ? guildConfig.name : guild.name)] });
		if (guildConfig.welcome.showMemberCount) content += "\n" + localizer.__("We are now **[[0]]** members.", { placeholders: [guild.memberCount.toString()] });

		const color: ColorResolvable = (await member.user.fetch(true)).accentColor || config.embedColor;

		const embed: EmbedBuilder = createEmbed()
			.setColor(color)
			.setTitle(localizer.__("[[0]] joined the server!", { placeholders: [member.user.username] }))
			.setDescription(content);

		if (guildConfig.welcome.showProfilePicture) {
			embed.setThumbnail(`https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.webp?size=512`);
		}

		if (guildConfig.welcome.customInfo) embed.addFields({ name: localizer._("Infos"), value: guildConfig.welcome.customInfo });

		await welcomeChannel.send({
			embeds: [embed]
		});
	});

	// Farewell
	client!.on("guildMemberRemove", async (member): Promise<void> => {
		if (debug) log("Welcome", localizer.__("[[0]] left [[1]]", { placeholders: [member.user.username, member.guild.name] }), "debug");

		// If there is nothing in the config for this server, skip.
		if (!(member.guild.id in servers)) {
			if (debug) log("Welcome", localizer.__("[[0]] is not in configuration file.", { placeholders: [member.guild.name] }), "debug");
			return;
		}

		const guild: Guild = member.guild;
		const guildConfig: ArtibotWelcomeServerConfig = servers[member.guild.id];
		// If farewell is not activated for the server, skip.
		if (!guildConfig.farewell.activate) return;
		if (!guildConfig.farewell.channel) {
			log("Welcome", localizer.__("No farewell channel set for [[0]]", { placeholders: [guild.name] }), "warn");
			return;
		}
		const farewellChannel: GuildBasedChannel | null = await member.guild.channels.fetch(guildConfig.farewell.channel);
		if (!farewellChannel) {
			log("Welcome", localizer.__("Farewell channel not found for [[0]]", { placeholders: [guild.name] }), "warn");
			return;
		}
		if (!farewellChannel.isTextBased()) {
			log("Welcome", localizer.__("Farewell channel is not text based for [[0]]", { placeholders: [guild.name] }), "warn");
			return;
		}

		// Create content for the embed, based on preferences from the config
		let content: string = localizer._("We hope to see you back soon!");
		if (guildConfig.farewell.showMemberCount) content += "\n" + localizer.__("We are now **[[0]]** members.", { placeholders: [guild.memberCount.toString()] });

		const color: ColorResolvable = (await member.user.fetch(true)).accentColor || config.embedColor;

		const embed: EmbedBuilder = createEmbed()
			.setColor(color)
			.setTitle(localizer.__("[[0]] left the server.", { placeholders: [member.user.username] }))
			.setDescription(content);

		if (guildConfig.farewell.showProfilePicture) {
			embed.setThumbnail(`https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.webp?size=512`);
		}

		if (guildConfig.farewell.customInfo) embed.addFields({ name: localizer._("Infos"), value: guildConfig.farewell.customInfo });

		await farewellChannel.send({
			embeds: [embed]
		});
	});

	log("Welcome", localizer._("Ready."));
}