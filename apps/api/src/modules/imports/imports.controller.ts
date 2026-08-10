import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { ImportMappingDto, ListImportItemsDto, ListImportsDto, MultipartUploadImportDto } from "./dto/imports.dto.js";
import { ImportsService } from "./imports.service.js";
interface UploadedImportFile { originalname: string; buffer: Buffer; }
@Controller("imports") @UseGuards(JwtAuthGuard) export class ImportsController {
 constructor(@Inject(ImportsService) private readonly service:ImportsService){}
 @Post("upload") @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024, files: 1 } })) upload(@CurrentUser() user:AuthenticatedUser,@Body() dto:MultipartUploadImportDto,@UploadedFile() file?:UploadedImportFile){if(!file)throw new BadRequestException({code:"FILE_REQUIRED",message:"File is required"});return this.service.upload(user.id,{accountId:dto.accountId,sourceType:dto.sourceType,fileName:file.originalname,contentBase64:file.buffer.toString("base64")});}
 @Get() list(@CurrentUser() user:AuthenticatedUser,@Query() query:ListImportsDto){return this.service.list(user.id,query);}
 @Get(":id") detail(@CurrentUser() user:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"})) id:string){return this.service.detail(user.id,id);}
 @Get(":id/items") items(@CurrentUser() user:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"})) id:string,@Query() query:ListImportItemsDto){return this.service.items(user.id,id,query);}
 @Patch(":id/mapping") mapping(@CurrentUser() user:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"})) id:string,@Body() dto:ImportMappingDto){return this.service.mapping(user.id,id,dto);}
 @Post(":id/confirm") confirm(@CurrentUser() user:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"})) id:string){return this.service.confirm(user.id,id);}
 @Post(":id/cancel") @HttpCode(200) cancel(@CurrentUser() user:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"})) id:string){return this.service.cancel(user.id,id);}
}
