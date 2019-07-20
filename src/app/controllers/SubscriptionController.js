import User from '../models/User';
import Meetup from '../models/Meetup';
import Subscription from '../models/Subscription';

import SubscriptionMail from '../jobs/SubscriptionMail';
import Queue from '../../lib/Queue';

class SubscriptionController {
  async index(req, res) {
    const meetups = await Subscription.findAll({
      where: { user_id: req.userId },
      include: [
        {
          model: Meetup,
          attributes: [
            'id',
            'title',
            'description',
            'location',
            'date',
            'past',
          ],
          order: [[Meetup, 'date']],
        },
      ],
    });

    return res.json(meetups);
  }

  async store(req, res) {
    const user = await User.findByPk(req.userId);
    const meetup = await Meetup.findByPk(req.params.meetupId, {
      include: [
        {
          model: User,
          as: 'user',
        },
      ],
    });

    const checkSubscribe = await Subscription.findOne({
      where: { user_id: user.id, meetup_id: meetup.id },
    });

    if (checkSubscribe) {
      return res
        .status(400)
        .json({ error: 'You are already subscribed to this meetup' });
    }

    if (meetup.user_id === user.id) {
      return res
        .status(400)
        .json({ error: 'You can not subscribe in your own meetup' });
    }

    if (meetup.past) {
      return res
        .status(400)
        .json({ error: 'You can not subscribe for past meetups' });
    }

    const checkDate = await Subscription.findOne({
      where: {
        user_id: user.id,
      },
      include: [
        {
          model: Meetup,
          required: true,
          where: {
            date: meetup.date,
          },
        },
      ],
    });

    if (checkDate) {
      return res.status(400).json({
        error: 'You can not subscribe in two meetups in the same time',
      });
    }

    const subscription = await Subscription.create({
      user_id: req.userId,
      meetup_id: req.params.meetupId,
    });

    await Queue.add(SubscriptionMail.key, {
      meetup,
    });

    return res.json(subscription);
  }
}

export default new SubscriptionController();
