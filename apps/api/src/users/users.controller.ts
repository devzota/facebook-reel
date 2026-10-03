import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ZTTeamUsersService } from './users.service';
import { ZTTeamRoles, ZTTeamRolesGuard } from '../auth/roles.guard';
import { ZTTeamRole } from '@prisma/client';
import { ZTTeamAuthGuard } from '../auth/auth.guard';

@Controller('users')
@UseGuards(ZTTeamAuthGuard, ZTTeamRolesGuard)
@ZTTeamRoles(ZTTeamRole.ADMIN)
export class ZTTeamUsersController {
  constructor(private readonly usersService: ZTTeamUsersService) { }

  @Get()
  async ztteam_findAll() {
    try {
      const users = await this.usersService.ztteam_findAll();
      return { success: true, data: users };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post()
  async ztteam_create(@Body() body: any) {
    try {
      if (!body.email || !body.password) {
        throw new Error('Email and password are required');
      }

      const existing = await this.usersService.ztteam_findByEmail(body.email);
      if (existing) {
        throw new Error('Email already exists');
      }

      const user = await this.usersService.ztteam_create({
        email: body.email,
        password_hash: body.password,
        role: body.role || ZTTeamRole.EDITOR,
      });

      const { password_hash, ...safeUser } = user;
      return { success: true, data: safeUser, message: 'User created successfully' };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id')
  async ztteam_update(@Param('id') id: string, @Body() body: any) {
    try {
      const updateData: any = {};
      if (body.role) updateData.role = body.role;
      if (body.password) updateData.password_hash = body.password;

      if (Object.keys(updateData).length === 0) {
        throw new Error('No data to update');
      }

      const user = await this.usersService.ztteam_update(id, updateData);
      return { success: true, data: user, message: 'User updated successfully' };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  async ztteam_delete(@Param('id') id: string) {
    try {
      await this.usersService.ztteam_delete(id);
      return { success: true, message: 'User deleted successfully' };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/assets')
  async ztteam_assignAssets(@Param('id') id: string, @Body() body: { assets: { asset_type: 'SITE' | 'PAGE', asset_id: string }[] }) {
    try {
      if (!body.assets || !Array.isArray(body.assets)) {
        throw new Error('Assets array is required');
      }
      await this.usersService.ztteam_assignAssets(id, body.assets);
      return { success: true, message: 'Assets assigned successfully' };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }
}
