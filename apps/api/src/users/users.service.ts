import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ztteam_users } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ZTTeamUsersService {
  constructor(private prisma: PrismaService) {}

  async ztteam_findByEmail(email: string): Promise<ztteam_users | null> {
    return this.prisma.ztteam_users.findUnique({
      where: { email },
    });
  }

  async ztteam_findById(id: string): Promise<ztteam_users | null> {
    return this.prisma.ztteam_users.findUnique({
      where: { id },
    });
  }

  async ztteam_create(data: Prisma.ztteam_usersCreateInput): Promise<ztteam_users> {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(data.password_hash, salt);
    
    return this.prisma.ztteam_users.create({
      data: {
        ...data,
        password_hash,
      },
    });
  }

  async ztteam_findAll() {
    return this.prisma.ztteam_users.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
        user_assets: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async ztteam_update(id: string, data: Partial<Prisma.ztteam_usersCreateInput>) {
    const updateData: any = { ...data };
    if (data.password_hash) {
      const salt = await bcrypt.genSalt(10);
      updateData.password_hash = await bcrypt.hash(data.password_hash, salt);
    }
    return this.prisma.ztteam_users.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async ztteam_delete(id: string) {
    return this.prisma.ztteam_users.delete({
      where: { id },
    });
  }

  async ztteam_assignAssets(userId: string, assets: { asset_type: 'SITE' | 'PAGE', asset_id: string }[]) {
    /** Xóa assets cũ */
    await this.prisma.ztteam_user_assets.deleteMany({
      where: { user_id: userId },
    });
    
    if (assets.length === 0) return true;

    /** Thêm assets mới */
    await this.prisma.ztteam_user_assets.createMany({
      data: assets.map(a => ({
        user_id: userId,
        asset_type: a.asset_type,
        asset_id: a.asset_id,
      })),
      skipDuplicates: true,
    });
    return true;
  }
}
