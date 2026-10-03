import { Controller, Post, Get, Delete, Patch, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ZTTeamWordpressService } from './wordpress.service';
import { ZTTeamAuthGuard } from '../auth/auth.guard';

@Controller('wordpress')
@UseGuards(ZTTeamAuthGuard)
export class ZTTeamWordpressController {
  constructor(private readonly wordpressService: ZTTeamWordpressService) {}

  @Post('test-connection')
  ztteam_testConnection(@Body() body: { wpUrl: string; wpUsername: string; wpAppPassword: string }) {
    return this.wordpressService.ztteam_testConnection(body.wpUrl, body.wpUsername, body.wpAppPassword);
  }

  @Post('sites')
  ztteam_createSite(@Body() body: { wpUrl: string; wpUsername: string; wpAppPassword: string }, @Request() req: any) {
    return this.wordpressService.ztteam_createTargetSite(req.user.sub, body);
  }

  @Get('sites')
  ztteam_getSites(@Request() req: any) {
    return this.wordpressService.ztteam_getTargetSites(req.user.sub);
  }

  @Patch('sites/:id')
  ztteam_updateSite(@Param('id') id: string, @Body() body: { wpUrl: string; wpUsername: string; wpAppPassword?: string }, @Request() req: any) {
    return this.wordpressService.ztteam_updateTargetSite(req.user.sub, id, body);
  }

  @Delete('sites/:id')
  ztteam_deleteSite(@Param('id') id: string, @Request() req: any) {
    return this.wordpressService.ztteam_deleteTargetSite(req.user.sub, id);
  }

  @Post('sites/:siteId/test-post')
  ztteam_testPost(@Param('siteId') siteId: string, @Body() body: { title: string; content: string; excerpt?: string; imageUrl?: string }) {
    return this.wordpressService.ztteam_createPost(siteId, body);
  }

  @Get('sites/:siteId/categories')
  ztteam_getCategories(@Param('siteId') siteId: string, @Request() req: any) {
    return this.wordpressService.ztteam_getCategories(siteId, req.user.sub);
  }

  @Get('sites/:siteId/tags')
  ztteam_getTags(@Param('siteId') siteId: string, @Request() req: any) {
    return this.wordpressService.ztteam_getTags(siteId, req.user.sub);
  }

  @Get('sites/:siteId/posts')
  ztteam_getPosts(
    @Param('siteId') siteId: string, 
    @Request() req: any,
    @Query('categoryId') categoryId?: string,
    @Query('targetTags') targetTags?: string
  ) {
    return this.wordpressService.ztteam_getPosts(siteId, req.user.sub, categoryId, targetTags);
  }

  @Get('sites/:siteId/sample-post')
  ztteam_getSamplePost(
    @Param('siteId') siteId: string, 
    @Request() req: any,
    @Query('categoryId') categoryId?: string,
    @Query('targetTags') targetTags?: string
  ) {
    return this.wordpressService.ztteam_getSamplePost(siteId, req.user.sub, categoryId, targetTags);
  }
}
