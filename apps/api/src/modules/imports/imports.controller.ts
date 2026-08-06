import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { ImportMappingDto, ListImportItemsDto, ListImportsDto, UploadImportDto } from "./dto/imports.dto.js";
import { ImportsService } from "./imports.service.js";
@Controller("imports") @UseGuards(JwtAuthGuard) export class ImportsController {
 constructor(@Inject(ImportsService) private readonly service:ImportsService){}
 @Post("upload") upload(@CurrentUser() user:AuthenticatedUser,@Body() dto:UploadImportDto){return this.service.upload(user.id,dto);}
 @Get() list(@CurrentUser() user:AuthenticatedUser,@Query() query:ListImportsDto){return this.service.list(user.id,query);}
 @Get(":id") detail(@CurrentUser() user:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"})) id:string){return this.service.detail(user.id,id);}
 @Get(":id/items") items(@CurrentUser() user:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"})) id:string,@Query() query:ListImportItemsDto){return this.service.items(user.id,id,query);}
 @Patch(":id/mapping") mapping(@CurrentUser() user:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"})) id:string,@Body() dto:ImportMappingDto){return this.service.mapping(user.id,id,dto);}
 @Post(":id/confirm") confirm(@CurrentUser() user:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"})) id:string){return this.service.confirm(user.id,id);}
 @Post(":id/cancel") @HttpCode(200) cancel(@CurrentUser() user:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"})) id:string){return this.service.cancel(user.id,id);}
}
